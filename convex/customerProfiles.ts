import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
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
    await checkRateLimit(ctx, 'saveMedicalAnswers', args.token)
    const { link, booking, profile } = await resolvePortalToken(ctx, args.token)

    // Sanitize string values in answers (booleans pass through)
    const sanitizedAnswers = sanitizeMedicalAnswers(args.answers)

    // Strip any keys not in the whitelist before storing
    const filtered = Object.fromEntries(
      Object.entries(sanitizedAnswers).filter(([key]) =>
        (MEDICAL_QUESTION_KEYS as readonly string[]).includes(key)
      )
    )

    // Any "Yes" triggers physician referral
    const hasYes = MEDICAL_QUESTION_KEYS.some((key) => filtered[key] === true)

    // Encrypt medical answers before writing to DB (skip encryption for empty records)
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

    // When customer re-submits with all "No" answers after a prior "Yes",
    // clean up the medical_block flag on the customer record so state is consistent.
    // (physicianClearanceRequired is already set above via the profile patch.)
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

    // DD-170: Extend hold TTL when medical hard block detected (36h + 8pm ceiling)
    if (hasYes) {
      const sessions = await ctx.db
        .query('bookingSessions')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', link.bookingId))
        .collect()

      if (sessions.length > 0) {
        const earliest = sessions.reduce((min, s) =>
          s.date < min.date ? s : min,
        )
        const newExpiresAt = computeMedicalDeadline(
          booking._creationTime,
          earliest.date,
          earliest.timezone ?? 'Asia/Bangkok',
        )
        // Only extend, never shorten
        if (newExpiresAt > (booking.expiresAt ?? 0)) {
          bookingPatch.expiresAt = newExpiresAt
        }
      }
    }

    await ctx.db.patch(link.bookingId, bookingPatch)

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
        type: NOTIFICATION_TYPE.MedicalHardBlock,
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

// ─── migratePlaintextMedical ─────────────────────────────────────────────────

/**
 * One-time migration: re-encrypt legacy plaintext medical answers with AES-256-GCM.
 *
 * For each customerProfile with a non-null medicalAnswers field:
 * - If the value is parseable as plaintext JSON: re-encrypt and write back
 * - If it fails JSON parse (already encrypted): skip
 *
 * Internal mutation — callable only from the dashboard or scheduled functions.
 * Processes up to `batchSize` records per invocation (default 50) to stay
 * within Convex mutation limits.
 */
export const migratePlaintextMedical = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ migrated: number; skipped: number; cursor: string | null }> => {
    const limit = args.batchSize ?? 50
    const cursorTime = args.cursor ? Number(args.cursor) : 0
    const profiles = await ctx.db
      .query('customerProfiles')
      .filter((q) => q.gt(q.field('_creationTime'), cursorTime))
      .take(limit + 1)

    const hasMore = profiles.length > limit
    const batch = hasMore ? profiles.slice(0, limit) : profiles

    let migrated = 0
    let skipped = 0

    for (const profile of batch) {
      if (!profile.medicalAnswers) {
        skipped++
        continue
      }

      // Try parsing as plaintext JSON (legacy format)
      try {
        const parsed = JSON.parse(profile.medicalAnswers as string)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          // Legacy plaintext record — re-encrypt
          const encrypted = await encryptMedical(parsed)
          await ctx.db.patch(profile._id, { medicalAnswers: encrypted }) // batch-exempt: sequential migration — each row needs individual encrypt + conditional patch
          migrated++
        } else {
          skipped++
        }
      } catch {
        // Not parseable as JSON — already encrypted, skip
        skipped++
      }
    }

    const nextCursor = hasMore
      ? String(batch[batch.length - 1]._creationTime)
      : null

    return { migrated, skipped, cursor: nextCursor }
  },
})
