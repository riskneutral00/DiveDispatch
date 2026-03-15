import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth, getAuthUser, OPERATOR_ROLE_SET, HOLD_TTL_MS, type AnyCtx } from './lib/auth'
import { releaseBookingReservations } from './bookingsMutations'

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
    const { user } = await requireAuth(ctx)
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
    const { user } = await requireAuth(ctx)
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
    const { user } = await requireAuth(ctx)

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
    const user = await getAuthUser(ctx)
    if (!user) return null

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) return null
    if (booking.ownerId !== user.slug) return null

    return booking
  },
})

// ─── Resumable draft types ────────────────────────────────────────────────────

export type ResumableDraft = {
  _id: string
  _creationTime: number
  activityType: string[]
  startDate: string
  endDate: string
  diverCount: number
  draftState: string
}

export type ResumableDraftsResult = {
  drafts: ResumableDraft[]
  hasMore: boolean
}

/**
 * Lists Draft bookings owned by the caller that have a saved draftState.
 * TTL-expired drafts are excluded (lazy expiry — filtered before the cron runs).
 * Returns at most 5, sorted by _creationTime descending. hasMore indicates more exist.
 * Exported for unit testing.
 */
export async function _listResumableDrafts(ctx: AnyCtx): Promise<ResumableDraftsResult> {
  const user = await getAuthUser(ctx)
  if (!user) return { drafts: [], hasMore: false }
  if (!OPERATOR_ROLE_SET.has(user.role as string)) return { drafts: [], hasMore: false }

  const now = Date.now()

  const allBookings = await ctx.db
    .query('bookings')
    .withIndex('by_ownerId_ownerType', (q: AnyCtx) => q.eq('ownerId', user.slug))
    .collect()

  const resumable = allBookings.filter(
    (b: AnyCtx) =>
      b.status === 'Draft' &&
      b.draftState != null &&
      (b.expiresAt == null || (b.expiresAt as number) >= now),
  )

  resumable.sort((a: AnyCtx, b: AnyCtx) => (b._creationTime as number) - (a._creationTime as number))

  const hasMore = resumable.length > 5
  const top = resumable.slice(0, 5)

  return {
    drafts: top.map((b: AnyCtx) => ({
      _id: b._id as string,
      _creationTime: b._creationTime as number,
      activityType: b.activityType as string[],
      startDate: b.startDate as string,
      endDate: b.endDate as string,
      diverCount: (b.divers as Array<unknown>).length,
      draftState: b.draftState as string,
    })),
    hasMore,
  }
}

export const listResumableDrafts = query({
  args: {},
  handler: _listResumableDrafts,
})

/**
 * Hard-deletes a Draft booking owned by the caller.
 * Vacates any active reservations, deletes sessions and booking links,
 * then removes the booking record entirely.
 * Used by the operator to discard in-progress wizard sessions.
 */
export const discardDraft = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx: AnyCtx, args: { bookingId: string }): Promise<void> => {
    const { user } = await requireAuth(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })
    if (booking.ownerId !== user.slug) throw new ConvexError({ code: 'FORBIDDEN' })
    if (booking.status !== 'Draft') throw new ConvexError({ code: 'INVALID_STATUS' })

    await releaseBookingReservations(ctx, args.bookingId, 'booking_cancelled')

    const sessions = await ctx.db
      .query('bookingSessions')
      .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const s of sessions) {
      await ctx.db.delete(s._id)
    }

    const links = await ctx.db
      .query('bookingLinks')
      .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', args.bookingId))
      .collect()
    for (const l of links) {
      await ctx.db.delete(l._id)
    }

    await ctx.db.delete(args.bookingId)
  },
})
