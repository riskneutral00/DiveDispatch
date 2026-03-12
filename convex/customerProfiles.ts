import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { notify } from './notifications'
import { tryAutoAdvance } from './bookingsMutations'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any

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
    // Validate token
    const link = await ctx.db
      .query('bookingLinks')
      .withIndex('by_token', (q: AnyCtx) => q.eq('token', args.token))
      .unique()

    if (!link) throw new ConvexError({ code: 'TOKEN_EXPIRED' })
    if (link.expiresAt < Date.now()) throw new ConvexError({ code: 'TOKEN_EXPIRED' })

    const booking = await ctx.db.get(link.bookingId)
    if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })
    if (booking.status !== 'Draft') throw new ConvexError({ code: 'BOOKING_CLOSED' })

    // Resolve profile by linkToken (same UUID as the bookingLink token)
    const profile = await ctx.db
      .query('customerProfiles')
      .withIndex('by_linkToken', (q: AnyCtx) => q.eq('linkToken', args.token))
      .unique()

    if (!profile) throw new ConvexError({ code: 'NOT_FOUND' })

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
      // Persist cross-DC visibility flag on the customer record
      const customer = await ctx.db.get(profile.customerId)
      if (customer) {
        const existing = customer.flags ?? []
        if (!existing.includes('medical_block')) {
          await ctx.db.patch(profile.customerId, {
            flags: [...existing, 'medical_block'],
          })
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
