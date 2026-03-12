import { ConvexError } from 'convex/values'
import { query } from './_generated/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any

// ─── Return types ─────────────────────────────────────────────────────────────

export type OpenRequest = {
  reservationId: string
  inventoryUnitId: string
  bookingId: string
  unitsRequested: number
  createdAt: number
  // Booking context
  activityType: string[]
  startDate: string
  endDate: string
  diverCount: number
  operatorName: string
}

export type ConfirmedScheduleItem = {
  reservationId: string
  inventoryUnitId: string
  bookingId: string
  unitsRequested: number
  confirmedAt: number | undefined
  // Booking context
  activityType: string[]
  startDate: string
  endDate: string
  diverCount: number
  operatorName: string
  // Sessions for this unit on this booking, sorted by date ascending
  sessions: Array<{
    sessionId: string
    date: string
    startTime: string
    endTime: string
    timezone: string
  }>
}

// ─── getOpenRequests ──────────────────────────────────────────────────────────

/**
 * Returns PendingAcceptance reservations for all inventory units owned by the
 * authenticated caller, enriched with booking context. Sorted by creation time
 * descending (newest first) so the most urgent request appears at the top.
 */
export async function _getOpenRequestsHandler(ctx: AnyCtx): Promise<OpenRequest[]> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' })

  const caller = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q: AnyCtx) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique()
  if (!caller) throw new ConvexError({ code: 'NOT_FOUND' })

  const units = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_ownerId_ownerType', (q: AnyCtx) =>
      q.eq('ownerId', caller.slug).eq('ownerType', caller.role),
    )
    .collect()

  const results: OpenRequest[] = []

  for (const unit of units) {
    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_inventoryUnitId_status', (q: AnyCtx) =>
        q.eq('inventoryUnitId', unit._id).eq('status', 'PendingAcceptance'),
      )
      .collect()

    for (const reservation of reservations) {
      const booking = await ctx.db.get(reservation.bookingId)
      if (!booking) continue

      results.push({
        reservationId: reservation._id,
        inventoryUnitId: unit._id,
        bookingId: reservation.bookingId,
        unitsRequested: reservation.unitsRequested,
        createdAt: reservation._creationTime,
        activityType: booking.activityType,
        startDate: booking.startDate,
        endDate: booking.endDate,
        diverCount: booking.divers.length,
        operatorName: booking.operatorName,
      })
    }
  }

  return results.sort((a, b) => b.createdAt - a.createdAt)
}

export const getOpenRequests = query({
  args: {},
  handler: _getOpenRequestsHandler,
})

// ─── getConfirmedSchedule ─────────────────────────────────────────────────────

/**
 * Returns Confirmed reservations for all inventory units owned by the
 * authenticated caller, enriched with booking context and per-unit session
 * details. Sorted by earliest session date ascending for calendar display.
 */
export async function _getConfirmedScheduleHandler(
  ctx: AnyCtx,
): Promise<ConfirmedScheduleItem[]> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' })

  const caller = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q: AnyCtx) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique()
  if (!caller) throw new ConvexError({ code: 'NOT_FOUND' })

  const units = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_ownerId_ownerType', (q: AnyCtx) =>
      q.eq('ownerId', caller.slug).eq('ownerType', caller.role),
    )
    .collect()

  const results: ConfirmedScheduleItem[] = []

  for (const unit of units) {
    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_inventoryUnitId_status', (q: AnyCtx) =>
        q.eq('inventoryUnitId', unit._id).eq('status', 'Confirmed'),
      )
      .collect()

    for (const reservation of reservations) {
      const booking = await ctx.db.get(reservation.bookingId)
      if (!booking) continue

      const allSessions = await ctx.db
        .query('bookingSessions')
        .withIndex('by_bookingId', (q: AnyCtx) => q.eq('bookingId', reservation.bookingId))
        .collect()

      const sessions = allSessions
        .filter((s: AnyCtx) => s.inventoryUnitId === unit._id)
        .map((s: AnyCtx) => ({
          sessionId: s._id,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          timezone: s.timezone,
        }))
        .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))

      results.push({
        reservationId: reservation._id,
        inventoryUnitId: unit._id,
        bookingId: reservation.bookingId,
        unitsRequested: reservation.unitsRequested,
        confirmedAt: reservation.confirmedAt,
        activityType: booking.activityType,
        startDate: booking.startDate,
        endDate: booking.endDate,
        diverCount: booking.divers.length,
        operatorName: booking.operatorName,
        sessions,
      })
    }
  }

  return results.sort((a, b) => {
    const aDate = a.sessions[0]?.date ?? a.startDate
    const bDate = b.sessions[0]?.date ?? b.startDate
    return aDate.localeCompare(bDate)
  })
}

export const getConfirmedSchedule = query({
  args: {},
  handler: _getConfirmedScheduleHandler,
})
