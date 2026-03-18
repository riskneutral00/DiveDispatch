import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { notify } from './notifications'
import { tryAutoAdvance } from './bookings/_shared'
import { type AnyCtx } from './lib/auth'
import { resolvePortalToken } from './lib/portal'

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
    ctx: AnyCtx,
    args: { token: string; answers: Record<string, boolean | string> },
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
    ctx: AnyCtx,
    args: { token: string; signatureStorageId: string; guardianSignatureStorageId?: string },
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
    ctx: AnyCtx,
    args: {
      token: string
      rentalChecklist: {
        mask: 'own' | 'rent'
        bcd: 'own' | 'rent'
        wetsuit: 'own' | 'rent'
        fins: 'own' | 'rent'
        regulator: 'own' | 'rent'
        maskPrescription?: string
      }
    },
  ): Promise<void> => {
    const { profile } = await resolvePortalToken(ctx, args.token)

    await ctx.db.patch(profile._id, { rentalChecklist: args.rentalChecklist })
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
    ctx: AnyCtx,
    args: { token: string },
  ): Promise<{
    answers: Record<string, boolean | string>
    physicianClearanceRequired: boolean
  } | null> => {
    const profile = await ctx.db
      .query('customerProfiles')
      .withIndex('by_linkToken', (q: AnyCtx) => q.eq('linkToken', args.token))
      .unique()

    if (!profile) return null

    return {
      answers: profile.medicalAnswers ?? {},
      physicianClearanceRequired: profile.physicianClearanceRequired,
    }
  },
})
