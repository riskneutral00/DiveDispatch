import { ConvexError, v } from 'convex/values'
import { z } from 'zod'
import { mutation, query } from './_generated/server'
import { tryAutoAdvance } from './bookings/_shared'
import { type AnyCtx } from './lib/auth'
import { resolvePortalToken } from './lib/portal'
import { validateOrThrow } from './lib/validate'

// Inline medical schema — mirrors medicalAnswersSchema from src/lib/validation/schemas.ts.
// Defined inline to avoid importing across the convex/ → src/ boundary.
const _medicalAnswersSchema = z.object({
  medical_q1: z.boolean(),
  medical_q2: z.boolean(),
  medical_q3: z.boolean(),
  medical_q4: z.boolean(),
  medical_q5: z.boolean(),
  medical_q6: z.boolean(),
  medical_q7: z.boolean(),
  medical_q8: z.boolean(),
  medical_q9: z.boolean(),
  medical_q10: z.boolean(),
})

// ─── getPortalStatus ──────────────────────────────────────────────────────────

/**
 * Returns the completion state of each portal step for a given token.
 * Public — token is the credential.
 * Used by portal-submit to enable/disable the final submit button.
 */
export const getPortalStatus = query({
  args: { token: v.string() },
  handler: async (
    ctx: AnyCtx,
    args: { token: string },
  ): Promise<{
    contactComplete: boolean
    medicalComplete: boolean
    waiverComplete: boolean
    medicalHardBlock: boolean
    portalContact: boolean
    portalMedical: boolean
    portalWaiver: boolean
    alreadySubmitted: boolean
  } | null> => {
    const link = await ctx.db
      .query('bookingLinks')
      .withIndex('by_token', (q: AnyCtx) => q.eq('token', args.token))
      .unique()
    if (!link) return null
    if (link.expiresAt < Date.now()) return null

    const booking = await ctx.db.get(link.bookingId)
    if (!booking) return null

    const profile = await ctx.db
      .query('customerProfiles')
      .withIndex('by_linkToken', (q: AnyCtx) => q.eq('linkToken', args.token))
      .unique()
    if (!profile) return null

    return {
      contactComplete: profile.customerId != null,
      medicalComplete: Object.keys(profile.medicalAnswers ?? {}).length > 0,
      waiverComplete: profile.waiverSignedAt != null,
      medicalHardBlock: booking.medicalHardBlock as boolean,
      portalContact: booking.portalContact as boolean,
      portalMedical: booking.portalMedical as boolean,
      portalWaiver: booking.portalWaiver as boolean,
      alreadySubmitted: profile.submittedAt != null,
    }
  },
})

// ─── submitPortal ─────────────────────────────────────────────────────────────

/**
 * Final portal submission mutation. Sets customerFormComplete=true on the
 * booking and triggers auto-advance evaluation.
 *
 * Auth boundary: token (no Clerk required).
 * TOCTOU-safe: token validation is re-executed inside the mutation body.
 */
export const submitPortal = mutation({
  args: { token: v.string() },
  handler: async (
    ctx: AnyCtx,
    args: { token: string },
  ): Promise<{ medicalHardBlock: boolean }> => {
    const { link, booking, profile } = await resolvePortalToken(ctx, args.token)

    // Validate required forms are complete
    if (booking.portalContact && !profile.customerId) {
      throw new ConvexError({
        code: 'FORMS_INCOMPLETE',
        reason: 'Contact form not submitted',
      })
    }
    if (booking.portalMedical && Object.keys(profile.medicalAnswers ?? {}).length === 0) {
      throw new ConvexError({
        code: 'FORMS_INCOMPLETE',
        reason: 'Medical questionnaire not submitted',
      })
    }
    if (booking.portalWaiver && !profile.waiverSignedAt) {
      throw new ConvexError({
        code: 'FORMS_INCOMPLETE',
        reason: 'Liability waiver not signed',
      })
    }

    // Server re-validation: validate stored medical answers are well-formed booleans.
    // Re-derive medicalHardBlock from raw answers — never trust cached booking flag.
    let medicalHardBlock = false
    if (booking.portalMedical && profile.medicalAnswers) {
      const validatedAnswers = validateOrThrow(_medicalAnswersSchema, profile.medicalAnswers)
      medicalHardBlock = Object.values(validatedAnswers).some((v) => v === true)
      // Keep booking flag in sync in case it drifted
      if ((booking.medicalHardBlock as boolean) !== medicalHardBlock) {
        await ctx.db.patch(link.bookingId, { medicalHardBlock })
      }
    }

    const now = Date.now()

    // Mark profile as submitted
    await ctx.db.patch(profile._id, { submittedAt: now })

    // Set customerFormComplete on booking — may trigger auto-advance
    await ctx.db.patch(link.bookingId, { customerFormComplete: true })

    // Attempt Draft → Upcoming auto-advance (silent no-op if conditions not met)
    await tryAutoAdvance(ctx, link.bookingId)

    return { medicalHardBlock }
  },
})
