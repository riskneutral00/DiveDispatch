import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { notify } from './notifications'
import { tryAutoAdvance } from './bookings/_shared'
import { resolvePortalToken } from './lib/portal'
import { sanitizeFields, PORTAL_SAFETY_FIELDS, PORTAL_EQUIPMENT_CHECKLIST_FIELDS } from './lib/sanitize'

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
] as const

// ─── saveMedicalAnswers ────────────────────────────────────────────────────────

/**
 * Saves PADI 10346 medical questionnaire answers for a customer portal session.
 *
 * Auth: token IS the credential (no Clerk auth). Validated against bookingLinks.
 * Any "Yes" answer triggers medicalHardBlock on the booking and physician referral
 * on the customerProfile. Notifies the booking owner via medical_hard_block notification.
 */
export const saveMedicalAnswers = mutation({
  args: {
    token: v.string(),
    answers: v.record(v.string(), v.union(v.boolean(), v.string())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ medicalHardBlock: boolean }> => {
    const { link, booking, profile } = await resolvePortalToken(ctx, args.token)

    // Any "Yes" triggers physician referral
    const hasYes = MEDICAL_QUESTION_KEYS.some((key) => args.answers[key] === true)

    await ctx.db.patch(profile._id, {
      medicalAnswers: args.answers,
      medicalSchemaVersion: MEDICAL_SCHEMA_VERSION,
      physicianClearanceRequired: hasYes,
    })

    await ctx.db.patch(link.bookingId, {
      medicalHardBlock: hasYes,
      portalMedical: true,
    })

    if (hasYes) {
      // Persist cross-DC visibility flag on the customer record (if contact step complete)
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
        type: 'medical_hard_block',
        bookingId: link.bookingId,
        message: `Medical block: ${link.customerName} requires physician clearance before diving.`,
      })
    }

    // Silent no-op if hard block is set or other conditions unmet
    await tryAutoAdvance(ctx, link.bookingId)

    return { medicalHardBlock: hasYes }
  },
})

// ─── savePortalWaiver ─────────────────────────────────────────────────────────

/**
 * Records the customer's signed liability waiver.
 *
 * Stores the signature file (from Convex storage) and timestamp, then sets
 * portalWaiver = true on the booking. Idempotent — re-submitting overwrites.
 * Auth: token IS the credential (no Clerk auth).
 */
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

// ─── savePortalEquipment ──────────────────────────────────────────────────────

/**
 * Saves the customer's rental equipment preferences and checklist.
 *
 * Stores own/rent decisions per gear type. Not a blocking portal step —
 * submitPortal does not require this to be complete. Idempotent.
 * Auth: token IS the credential (no Clerk auth).
 */
export const savePortalEquipment = mutation({
  args: {
    token: v.string(),
    rentalChecklist: v.object({
      mask: v.union(v.literal('own'), v.literal('rent')),
      bcd: v.union(v.literal('own'), v.literal('rent')),
      wetsuit: v.union(v.literal('own'), v.literal('rent')),
      fins: v.union(v.literal('own'), v.literal('rent')),
      regulator: v.union(v.literal('own'), v.literal('rent')),
      maskPrescription: v.optional(v.string()),
    }),
  },
  handler: async (
    ctx,
    args,
  ): Promise<void> => {
    const { profile } = await resolvePortalToken(ctx, args.token)
    const sanitizedChecklist = sanitizeFields(args.rentalChecklist, PORTAL_EQUIPMENT_CHECKLIST_FIELDS)

    await ctx.db.patch(profile._id, { rentalChecklist: sanitizedChecklist })
  },
})

// ─── saveSafetyInfo ───────────────────────────────────────────────────────────

/**
 * Saves optional safety info (blood type, allergies, medications, insurance).
 * All fields are optional — customer may submit with none, some, or all.
 * Does not affect customerFormComplete or auto-advance. Idempotent.
 * Auth: token IS the credential (no Clerk auth).
 */
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
  },
})

// ─── getSafetyInfoByToken ─────────────────────────────────────────────────────

/**
 * Returns saved safety info for the portal session identified by token.
 * Used to pre-fill the form when a customer returns to the portal.
 * Public — token is the credential.
 */
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
    const profile = await ctx.db
      .query('customerProfiles')
      .withIndex('by_linkToken', (q) => q.eq('linkToken', args.token))
      .unique()

    if (!profile) return null

    return {
      bloodType: profile.bloodType ?? '',
      allergies: profile.allergies ?? '',
      medications: profile.medications ?? '',
      insurancePolicyNumber: profile.insurancePolicyNumber ?? '',
    }
  },
})

// ─── getMedicalByToken ─────────────────────────────────────────────────────────

/**
 * Returns saved medical answers for the portal session identified by token.
 * Used to pre-fill the form when a customer returns to the portal.
 * Public — token is the credential.
 */
export const getMedicalByToken = query({
  args: { token: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    answers: Record<string, boolean | string>
    physicianClearanceRequired: boolean
  } | null> => {
    const profile = await ctx.db
      .query('customerProfiles')
      .withIndex('by_linkToken', (q) => q.eq('linkToken', args.token))
      .unique()

    if (!profile) return null

    return {
      answers: profile.medicalAnswers ?? {},
      physicianClearanceRequired: profile.physicianClearanceRequired ?? false,
    }
  },
})
