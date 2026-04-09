import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { notify } from './notifications'
import { tryAutoAdvance, computeMedicalDeadline } from './bookings/_shared'
import { resolvePortalToken, resolvePortalTokenSoft } from './lib/portal'
import { sanitizeFields, sanitizeMedicalAnswers, PORTAL_SAFETY_FIELDS, PORTAL_EQUIPMENT_CHECKLIST_FIELDS } from './lib/sanitize'
import { encryptMedical, safeDecryptMedical } from './lib/crypto'
import { checkRateLimit } from './lib/rateLimiter'
import { rentalChecklistValidator } from './lib/validators'
import { NOTIFICATION_TYPE } from './shared/statuses'

const MEDICAL_SCHEMA_VERSION = '10346_v1'

const MEDICAL_QUESTION_KEYS = [
  'medical_q1',
  'medical_q2',
  'medical_q3',
  'medical_q4',
  'medical_q5',
  'medical_q6',
  'medical_q7',
  'medical_q8',
  'medical_q9',
  'medical_q10',
  'medical_details',
] as const

export const saveMedicalAnswers = mutation({
  args: {
    token: v.string(),
    answers: v.record(v.string(), v.union(v.boolean(), v.string())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ medicalHardBlock: boolean }> => {
    await checkRateLimit(ctx, 'saveMedicalAnswers', args.token)
    const { link, booking, profile } = await resolvePortalToken(ctx, args.token)

    const sanitizedAnswers = sanitizeMedicalAnswers(args.answers)

    const filtered = Object.fromEntries(
      Object.entries(sanitizedAnswers).filter(([key]) =>
        (MEDICAL_QUESTION_KEYS as readonly string[]).includes(key)
      )
    )

    const hasYes = MEDICAL_QUESTION_KEYS.some((key) => filtered[key] === true)

    const hasAnswers = Object.keys(filtered).length > 0
    const encryptedAnswers = hasAnswers ? await encryptMedical(filtered) : undefined

    await ctx.db.patch(profile._id, {
      medicalAnswers: encryptedAnswers,
      medicalSchemaVersion: MEDICAL_SCHEMA_VERSION,
      physicianClearanceRequired: hasYes,
    })

    const bookingPatch: {
      medicalHardBlock: boolean
      portalMedical: boolean
      expiresAt?: number
    } = {
      medicalHardBlock: hasYes,
      portalMedical: true,
    }

    if (!hasYes && booking.medicalHardBlock && profile.customerId) {
      const customer = await ctx.db.get(profile.customerId)
      if (customer) {
        const flags = customer.flags ?? []
        if (flags.includes('medical_block')) {
          await ctx.db.patch(profile.customerId, {
            flags: flags.filter((f) => f !== 'medical_block') as ('medical_block')[],
          })
        }
      }
    }

    if (hasYes) {
      const sessions = await ctx.db
        .query('bookingSessions')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', link.bookingId))
        .collect() // bounded: per-booking profiles

      if (sessions.length > 0) {
        const earliest = sessions.reduce((min, s) =>
          s.date < min.date ? s : min,
        )
        const newExpiresAt = computeMedicalDeadline(
          booking._creationTime,
          earliest.date,
          earliest.timezone ?? 'Asia/Bangkok',
        )
        if (newExpiresAt > (booking.expiresAt ?? 0)) {
          bookingPatch.expiresAt = newExpiresAt
        }
      }
    }

    await ctx.db.patch(link.bookingId, bookingPatch)

    if (hasYes) {
      if (profile.customerId) {
        const customer = await ctx.db.get(profile.customerId)
        if (customer) {
          const existing = customer.flags ?? []
          if (!existing.includes('medical_block')) {
            await ctx.db.patch(profile.customerId, {
              flags: [...existing, 'medical_block'],
            })
          }
        }
      }

      await notify(ctx, {
        userId: booking.ownerId,
        type: NOTIFICATION_TYPE.MedicalHardBlock,
        bookingId: link.bookingId,
        code: 'medical_hard_block',
        params: { customerName: link.customerName },
        message: `Medical block: ${link.customerName} requires physician clearance before diving.`,
      })
    }

    await tryAutoAdvance(ctx, link.bookingId)

    return { medicalHardBlock: hasYes }
  },
})

export const savePortalWaiver = mutation({
  args: {
    token: v.string(),
    signatureStorageId: v.id('_storage'),
    guardianSignatureStorageId: v.optional(v.id('_storage')),
  },
  handler: async (
    ctx,
    args,
  ): Promise<void> => {
    await checkRateLimit(ctx, 'savePortalWaiver', args.token)
    const { link, profile } = await resolvePortalToken(ctx, args.token)

    const patch: Record<string, unknown> = {
      waiverSignedAt: Date.now(),
      signatureFileId: args.signatureStorageId,
    }
    if (args.guardianSignatureStorageId) {
      patch.guardianSignatureFileId = args.guardianSignatureStorageId
    }

    await ctx.db.patch(profile._id, patch)
    await ctx.db.patch(link.bookingId, { portalWaiver: true })
    await tryAutoAdvance(ctx, link.bookingId)
  },
})

export const savePortalEquipment = mutation({
  args: {
    token: v.string(),
    rentalChecklist: rentalChecklistValidator,
  },
  handler: async (
    ctx,
    args,
  ): Promise<void> => {
    await checkRateLimit(ctx, 'savePortalEquipment', args.token)
    const { profile } = await resolvePortalToken(ctx, args.token)
    const sanitizedChecklist = sanitizeFields(args.rentalChecklist, PORTAL_EQUIPMENT_CHECKLIST_FIELDS)

    await ctx.db.patch(profile._id, { rentalChecklist: sanitizedChecklist })
  },
})

export const saveSafetyInfo = mutation({
  args: {
    token: v.string(),
    bloodType: v.optional(v.string()),
    allergies: v.optional(v.string()),
    medications: v.optional(v.string()),
    insurancePolicyNumber: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<void> => {
    await checkRateLimit(ctx, 'saveSafetyInfo', args.token)
    const { profile } = await resolvePortalToken(ctx, args.token)
    const sanitized = sanitizeFields(args, PORTAL_SAFETY_FIELDS)

    const patch: Record<string, string | undefined> = {}
    if (sanitized.bloodType !== undefined) patch.bloodType = sanitized.bloodType as string
    if (sanitized.allergies !== undefined) patch.allergies = sanitized.allergies as string
    if (sanitized.medications !== undefined) patch.medications = sanitized.medications as string
    if (sanitized.insurancePolicyNumber !== undefined)
      patch.insurancePolicyNumber = sanitized.insurancePolicyNumber as string

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(profile._id, patch)
    }

    if (sanitized.allergies !== undefined && profile.customerId) {
      await ctx.db.patch(profile.customerId, { allergies: sanitized.allergies as string })
    }
  },
})

export const getSafetyInfoByToken = query({
  args: { token: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    bloodType: string
    allergies: string
    medications: string
    insurancePolicyNumber: string
  } | null> => {
    const resolved = await resolvePortalTokenSoft(ctx, args.token)
    if (!resolved) return null

    const { profile } = resolved

    return {
      bloodType: profile.bloodType ?? '',
      allergies: profile.allergies ?? '',
      medications: profile.medications ?? '',
      insurancePolicyNumber: profile.insurancePolicyNumber ?? '',
    }
  },
})

export const getMedicalByToken = query({
  args: { token: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    answers: Record<string, boolean | string>
    physicianClearanceRequired: boolean
  } | null> => {
    const resolved = await resolvePortalTokenSoft(ctx, args.token)
    if (!resolved) return null

    const { profile } = resolved

    const answers: Record<string, boolean | string> = profile.medicalAnswers
      ? await safeDecryptMedical(profile.medicalAnswers)
      : {}

    return {
      answers,
      physicianClearanceRequired: profile.physicianClearanceRequired ?? false,
    }
  },
})
