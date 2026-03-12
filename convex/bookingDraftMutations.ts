import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any

const HOLD_TTL_MS = 43200000 // 12 hours (per CLAUDE.md default)

const OPERATOR_ROLE_SET = new Set([
  'DiveCenter',
  'Agent',
  'Liveaboard',
  'DiveResort',
  'DiveHostel',
  'DiveSite',
])

type OperatorType =
  | 'DiveCenter'
  | 'Agent'
  | 'Liveaboard'
  | 'DiveResort'
  | 'DiveHostel'
  | 'DiveSite'

/**
 * Creates a minimal Draft booking shell. Called once when the wizard first opens
 * for a new booking. Returns bookingId for subsequent saveDraftState calls.
 * Fails fast if caller is not an organizer role.
 *
 * For Agent callers in independent mode: agent is owner, agentId is set for
 * dashboard listing via the by_agentId index.
 * For referral mode use createReferralDraftShell instead.
 */
export const createDraftShell = mutation({
  args: {},
  handler: async (ctx: AnyCtx): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' })

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q: AnyCtx) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    if (!user) throw new ConvexError({ code: 'NOT_FOUND' })
    if (!OPERATOR_ROLE_SET.has(user.role)) throw new ConvexError({ code: 'FORBIDDEN' })

    const today = new Date().toISOString().split('T')[0]

    // For Agent callers, always stamp agentId so the by_agentId index surfaces this booking.
    const agentId = user.role === 'Agent' ? (user.slug as string) : undefined

    const bookingId = await ctx.db.insert('bookings', {
      ownerId: user.slug,
      ownerType: user.role as OperatorType,
      status: 'Draft' as const,
      createdAt: Date.now(),
      holdTTL: HOLD_TTL_MS,
      paid: false,
      activityType: [],
      startDate: today,
      endDate: today,
      divers: [],
      agentId,
      operatorName: user.businessName,
      portalContact: true,
      portalMedical: true,
      portalWaiver: true,
      medicalHardBlock: false,
      bookingFormComplete: false,
      customerFormComplete: false,
    })

    return bookingId as string
  },
})

/**
 * Creates a referral Draft booking shell. Agent refers a customer to a DC —
 * the DC becomes the booking owner and handles the booking from here.
 * Agent's involvement ends after this call; they can track via by_agentId index.
 */
export const createReferralDraftShell = mutation({
  args: {
    referralDcSlug: v.string(),
  },
  handler: async (ctx: AnyCtx, args: { referralDcSlug: string }): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' })

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q: AnyCtx) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    if (!user) throw new ConvexError({ code: 'NOT_FOUND' })
    if (user.role !== 'Agent') throw new ConvexError({ code: 'FORBIDDEN' })

    const dcUser = await ctx.db
      .query('users')
      .withIndex('by_slug', (q: AnyCtx) => q.eq('slug', args.referralDcSlug))
      .unique()
    if (!dcUser) throw new ConvexError({ code: 'NOT_FOUND' })
    if (!OPERATOR_ROLE_SET.has(dcUser.role as string)) {
      throw new ConvexError({ code: 'FORBIDDEN' })
    }

    const today = new Date().toISOString().split('T')[0]

    const bookingId = await ctx.db.insert('bookings', {
      ownerId: dcUser.slug as string,
      ownerType: dcUser.role as OperatorType,
      status: 'Draft' as const,
      createdAt: Date.now(),
      holdTTL: HOLD_TTL_MS,
      paid: false,
      activityType: [],
      startDate: today,
      endDate: today,
      divers: [],
      agentId: user.slug as string,
      agentIsReferral: true,
      // operatorName is the DC's business name since they own the booking
      operatorName: dcUser.businessName as string,
      portalContact: true,
      portalMedical: true,
      portalWaiver: true,
      medicalHardBlock: false,
      bookingFormComplete: false,
      customerFormComplete: false,
    })

    return bookingId as string
  },
})

/**
 * Persists the serialized wizard state to bookings.draftState.
 * Called on every step change so operators can resume later via edit mode.
 * Only allowed on Draft bookings owned by the caller.
 */
export const saveDraftState = mutation({
  args: {
    bookingId: v.id('bookings'),
    draftState: v.string(),
  },
  handler: async (
    ctx: AnyCtx,
    args: { bookingId: string; draftState: string },
  ): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' })

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q: AnyCtx) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    if (!user) throw new ConvexError({ code: 'NOT_FOUND' })

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })
    if (booking.ownerId !== user.slug) throw new ConvexError({ code: 'FORBIDDEN' })
    if (booking.status !== 'Draft') throw new ConvexError({ code: 'INVALID_STATUS' })

    await ctx.db.patch(args.bookingId, { draftState: args.draftState })
  },
})

/**
 * Returns a booking owned by the caller for the wizard to pre-fill.
 * Returns null if not found or caller does not own it.
 * Used by edit mode to restore draftState or pre-fill from booking fields.
 */
export const getBookingForWizard = query({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx: AnyCtx, args: { bookingId: string }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q: AnyCtx) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    if (!user) return null

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) return null
    if (booking.ownerId !== user.slug) return null

    return booking
  },
})
