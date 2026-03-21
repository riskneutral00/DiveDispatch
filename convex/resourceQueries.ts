import { query } from './_generated/server'
import { requireAuth, type AnyCtx } from './lib/auth'

// ─── Return types ─────────────────────────────────────────────────────────────

export type OpenRequest = {
  reservationIds: string[]
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
  const { user: caller } = await requireAuth(ctx)

  const units = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_ownerId_ownerType', (q: AnyCtx) =>
      q.eq('ownerId', caller.slug).eq('ownerType', caller.role),
    )
    .collect()

  // Group reservations by booking+unit to deduplicate multi-day bookings
  const byBooking = new Map<string, { unitId: string; resIds: string[]; units: number; createdAt: number }>()

  for (const unit of units) {
    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_inventoryUnitId_status', (q: AnyCtx) =>
        q.eq('inventoryUnitId', unit._id).eq('status', 'PendingAcceptance'),
      )
      .collect()

    for (const res of reservations) {
      const key = `${res.bookingId as string}|${unit._id as string}`
      const existing = byBooking.get(key)
      if (existing) {
        existing.resIds.push(res._id as string)
        existing.createdAt = Math.max(existing.createdAt, res._creationTime)
      } else {
        byBooking.set(key, {
          unitId: unit._id as string,
          resIds: [res._id as string],
          units: res.unitsRequested as number,
          createdAt: res._creationTime,
        })
      }
    }
  }

  const results: OpenRequest[] = []

  for (const [key, { unitId, resIds, units: unitsRequested, createdAt }] of byBooking) {
    const bookingId = key.split('|')[0]
    const booking = await ctx.db.get(bookingId)
    if (!booking) continue

    results.push({
      reservationIds: resIds,
      inventoryUnitId: unitId,
      bookingId,
      unitsRequested,
      createdAt,
      activityType: booking.activityType as string[],
      startDate: booking.startDate as string,
      endDate: booking.endDate as string,
      diverCount: (booking.divers as unknown[]).length,
      operatorName: booking.operatorName as string,
    })
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
  const { user: caller } = await requireAuth(ctx)

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
