import { v } from 'convex/values'
import { query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireAuth } from './lib/auth'
import { requireActiveRole } from './userRoles'
import type { ResourceOwnerType } from './shared/resourceOwnerTypes'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'
import { RESERVATION_STATUS } from './shared/statuses'

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
export async function _getOpenRequestsHandler(ctx: QueryCtx, activeRole: string): Promise<OpenRequest[]> {
  const { user: caller } = await requireAuth(ctx)
  await requireActiveRole(ctx, caller._id, activeRole)

  const units = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_ownerId_ownerType', (q) =>
      q.eq('ownerId', caller.slug).eq('ownerType', activeRole as ResourceOwnerType),
    )
    .collect()

  // Group reservations by booking+unit to deduplicate multi-day bookings
  const byBooking = new Map<string, { unitId: string; resIds: string[]; units: number; createdAt: number }>()

  const unitReservationPairs = await Promise.all(
    units.map(async (unit) => {
      const reservations = await ctx.db
        .query('reservations')
        .withIndex('by_inventoryUnitId_status', (q) =>
          q.eq('inventoryUnitId', unit._id).eq('status', RESERVATION_STATUS.PendingAcceptance),
        )
        .collect()
      return { unit, reservations }
    }),
  )

  for (const { unit, reservations } of unitReservationPairs) {
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

  // Batch-fetch all referenced bookings in parallel
  const uniqueBookingIds = [...new Set([...byBooking.keys()].map(k => k.split('|')[0]))]
  const bookingDocs = await Promise.all(uniqueBookingIds.map(id => ctx.db.get(id as Id<'bookings'>)))
  const bookingMap = new Map(
    bookingDocs.filter(Boolean).map((b) => [b!._id as string, b!]),
  )

  const results: OpenRequest[] = []

  for (const [key, { unitId, resIds, units: unitsRequested, createdAt }] of byBooking) {
    const bookingId = key.split('|')[0]
    const booking = bookingMap.get(bookingId)
    if (!booking) continue

    results.push({
      reservationIds: resIds,
      inventoryUnitId: unitId,
      bookingId,
      unitsRequested,
      createdAt,
      activityType: booking.activityType as string[],
      startDate: booking.startDate,
      endDate: booking.endDate,
      diverCount: booking.divers.length,
      operatorName: booking.operatorName,
    })
  }

  return results.sort((a, b) => b.createdAt - a.createdAt)
}

export const getOpenRequests = query({
  args: { activeRole: stakeholderType },
  handler: (ctx, args) => _getOpenRequestsHandler(ctx, args.activeRole),
})

// ─── getConfirmedSchedule ─────────────────────────────────────────────────────

/**
 * Returns Confirmed reservations for all inventory units owned by the
 * authenticated caller, enriched with booking context and per-unit session
 * details. Sorted by earliest session date ascending for calendar display.
 */
export async function _getConfirmedScheduleHandler(
  ctx: QueryCtx,
  activeRole: string,
): Promise<ConfirmedScheduleItem[]> {
  const { user: caller } = await requireAuth(ctx)
  await requireActiveRole(ctx, caller._id, activeRole)

  const units = await ctx.db
    .query('inventoryUnits')
    .withIndex('by_ownerId_ownerType', (q) =>
      q.eq('ownerId', caller.slug).eq('ownerType', activeRole as ResourceOwnerType),
    )
    .collect()

  // Collect all confirmed reservations across all units
  const unitConfirmedPairs = await Promise.all(
    units.map(async (unit) => {
      const reservations = await ctx.db
        .query('reservations')
        .withIndex('by_inventoryUnitId_status', (q) =>
          q.eq('inventoryUnitId', unit._id).eq('status', RESERVATION_STATUS.Confirmed),
        )
        .collect()
      return { unit, reservations }
    }),
  )
  const allReservations: Array<{ unit: Doc<'inventoryUnits'>; reservation: Doc<'reservations'> }> = []
  for (const { unit, reservations } of unitConfirmedPairs) {
    for (const reservation of reservations) {
      allReservations.push({ unit, reservation })
    }
  }

  // Batch-fetch all referenced bookings and sessions in parallel
  const uniqueBookingIds = [...new Set(allReservations.map(r => r.reservation.bookingId as string))]
  const [bookingDocs, sessionsByBooking] = await Promise.all([
    Promise.all(uniqueBookingIds.map(id => ctx.db.get(id as Id<'bookings'>))),
    Promise.all(
      uniqueBookingIds.map(id =>
        ctx.db.query('bookingSessions')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', id as Id<'bookings'>))
          .collect(),
      ),
    ),
  ])

  const bookingMap = new Map(
    bookingDocs.filter(Boolean).map((b) => [b!._id as string, b!]),
  )
  const sessionMap = new Map(
    uniqueBookingIds.map((id, i) => [id, sessionsByBooking[i]]),
  )

  const results: ConfirmedScheduleItem[] = []

  for (const { unit, reservation } of allReservations) {
    const booking = bookingMap.get(reservation.bookingId as string)
    if (!booking) continue

    const sessions = (sessionMap.get(reservation.bookingId as string) ?? [])
      .filter((s) => s.inventoryUnitId === unit._id)
      .map((s) => ({
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

  return results.sort((a, b) => {
    const aDate = a.sessions[0]?.date ?? a.startDate
    const bDate = b.sessions[0]?.date ?? b.startDate
    return aDate.localeCompare(bDate)
  })
}

export const getConfirmedSchedule = query({
  args: { activeRole: stakeholderType },
  handler: (ctx, args) => _getConfirmedScheduleHandler(ctx, args.activeRole),
})
