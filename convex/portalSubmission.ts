import { ConvexError, v } from 'convex/values'
import { z } from 'zod'
import { mutation, query } from './_generated/server'
import { tryAutoAdvance, computeMedicalDeadline } from './bookings/_shared'
import { resolvePortalToken } from './lib/portal'
import { checkRateLimit } from './lib/rateLimiter'
import { validateOrThrow } from './lib/validate'
import { ErrorCode } from './lib/errorCodes'

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
    ctx,
    args,
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
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()
    if (!link) return null
    if (link.expiresAt < Date.now()) return null

    const booking = await ctx.db.get(link.bookingId)
    if (!booking) return null

    const profile = await ctx.db
      .query('customerProfiles')
      .withIndex('by_linkToken', (q) => q.eq('linkToken', args.token))
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
    ctx,
    args,
  ): Promise<{ medicalHardBlock: boolean }> => {
    await checkRateLimit(ctx, 'submitPortal', args.token)

    const { link, booking, profile } = await resolvePortalToken(ctx, args.token)

    // Validate required forms are complete
    if (booking.portalContact && !profile.customerId) {
      throw new ConvexError({
        code: ErrorCode.FORMS_INCOMPLETE,
        reason: 'Contact form not submitted',
      })
    }
    if (booking.portalMedical && Object.keys(profile.medicalAnswers ?? {}).length === 0) {
      throw new ConvexError({
        code: ErrorCode.FORMS_INCOMPLETE,
        reason: 'Medical questionnaire not submitted',
      })
    }
    if (booking.portalWaiver && !profile.waiverSignedAt) {
      throw new ConvexError({
        code: ErrorCode.FORMS_INCOMPLETE,
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
        const bookingPatch: Record<string, unknown> = { medicalHardBlock }

        // Extend hold TTL when medical block activates (CLAUDE.md: 36h total, 8pm ceiling)
        if (medicalHardBlock) {
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
            if (newExpiresAt > ((booking.expiresAt as number) ?? 0)) {
              bookingPatch.expiresAt = newExpiresAt
            }
          }
        }

        await ctx.db.patch(link.bookingId, bookingPatch)
      }
    }

    const now = Date.now()

    // Mark profile as submitted
    await ctx.db.patch(profile._id, { submittedAt: now })

    // Set customerFormComplete on booking — may trigger auto-advance
    await ctx.db.patch(link.bookingId, { customerFormComplete: true })

    // Invalidate the token — prevents re-submission via the same link
    await ctx.db.patch(link._id, { usedAt: now })

    // Attempt Draft → Upcoming auto-advance (silent no-op if conditions not met)
    await tryAutoAdvance(ctx, link.bookingId)

    return { medicalHardBlock }
  },
})
