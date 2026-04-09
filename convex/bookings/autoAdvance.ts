import { ConvexError } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { getResourcesForBooking } from '../bookingResources'
import { restoreSnapshotUnits, getAvailabilitySnapshot } from './inventoryRelease'
import { BOOKING_STATUS, RESERVATION_STATUS, VACATED_REASON, NOTIFICATION_TYPE } from '../shared/statuses'
import { ErrorCode } from '../lib/errorCodes'
import { notify } from '../notifications'
import type { NotificationLogistics } from '../shared/notificationLogistics'

export async function tryAutoAdvance(ctx: MutationCtx, bookingId: string): Promise<void> {
  const booking = await ctx.db.get(bookingId as Id<'bookings'>)
  if (!booking || booking.status !== BOOKING_STATUS.Draft) return
  if (!booking.bookingFormComplete || !booking.customerFormComplete) return
  if (booking.medicalHardBlock) return

  const bookingResourceRows = await getResourcesForBooking(ctx, bookingId)
  const hasInSystemEM = bookingResourceRows.some(
    (r: { resourceType: string; resourceId?: string }) =>
      r.resourceType === 'Equipment' && r.resourceId,
  )
  if (hasInSystemEM) {
    const profiles = await ctx.db
      .query('customerProfiles')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
      .collect() // bounded: per-booking profiles

    const allOwnGear =
      profiles.length > 0 &&
      profiles.every((p) => {
        if (!p.rentalChecklist) return false
        const c = p.rentalChecklist
        return (
          c.mask === 'own' &&
          c.bcd === 'own' &&
          c.wetsuit === 'own' &&
          c.fins === 'own' &&
          c.regulator === 'own'
        )
      })

    if (allOwnGear) {
      const allReservations = await ctx.db
        .query('reservations')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
        .take(100)

      const seenSnapshotIds = new Set<string>()
      for (const res of allReservations) {
        if (res.status === RESERVATION_STATUS.Vacated || res.status === RESERVATION_STATUS.NoShow) continue
        const fresh = await ctx.db.get(res._id) // batch-exempt: guard read per-reservation, sequential intentional
        if (!fresh || fresh.status === RESERVATION_STATUS.Vacated) continue
        const unit = await ctx.db.get(res.inventoryUnitId) // batch-exempt: conditional check per reservation
        if (!unit || unit.resourceType !== 'Equipment') continue

        const session = await ctx.db.get(res.bookingSessionId) // batch-exempt: paired with snapshot fetch per reservation
        if (!session) {
          throw new ConvexError({
            code: ErrorCode.ORPHANED_RESERVATION,
            reason: `Reservation ${res._id} references missing session ${res.bookingSessionId}. Aborting EM auto-release to prevent inventory leak.`,
          })
        }
        const snapshot = await getAvailabilitySnapshot(ctx, res.inventoryUnitId, session.date, session.startTime)
        if (!snapshot) {
          throw new ConvexError({
            code: ErrorCode.MISSING_SNAPSHOT,
            reason: `No availability snapshot found for unit ${res.inventoryUnitId} on ${session.date} at ${session.startTime}. Aborting EM auto-release to prevent inventory leak.`,
          })
        }

        await ctx.db.patch(res._id, { // batch-exempt: Invariant 3 requires paired reservation + snapshot writes
          status: RESERVATION_STATUS.Vacated,
          vacatedAt: Date.now(),
          vacatedBy: VACATED_REASON.EquipmentNotNeeded,
        })

        await restoreSnapshotUnits(ctx, snapshot._id, res.unitsRequested, seenSnapshotIds)
      }
    }
  }

  const freshBooking = await ctx.db.get(bookingId as Id<'bookings'>)
  if (!freshBooking || freshBooking.status !== BOOKING_STATUS.Draft) return

  const reservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .take(100)

  const active = reservations.filter(
    (r) => r.status !== RESERVATION_STATUS.Vacated && r.status !== RESERVATION_STATUS.NoShow,
  )
  const hasMissingResource = reservations.some(
    (r) =>
      r.status === RESERVATION_STATUS.Vacated &&
      (r.vacatedBy === VACATED_REASON.StakeholderDeclined ||
        r.vacatedBy === VACATED_REASON.DateBlocked),
  )

  const allConfirmed = active.every((r) => r.status === RESERVATION_STATUS.Confirmed)

  if (allConfirmed && !hasMissingResource) {
    await ctx.db.patch(bookingId as Id<'bookings'>, { status: BOOKING_STATUS.Upcoming })

    let logistics: NotificationLogistics | undefined
    try {
      logistics = await collectLogistics(ctx, bookingId as Id<'bookings'>)
    } catch {
    }
    await notify(ctx, {
      userId: freshBooking.ownerId,
      type: NOTIFICATION_TYPE.BookingConfirmed,
      bookingId: bookingId as Id<'bookings'>,
      code: 'booking_confirmed',
      message: 'Your booking is confirmed.',
      logistics,
    })
  }
}

async function collectLogistics(
  ctx: MutationCtx,
  bookingId: Id<'bookings'>,
): Promise<NotificationLogistics> {
  const logistics: NotificationLogistics = {}

  const sessions = await ctx.db
    .query('bookingSessions')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
    .collect() // bounded: per-booking sessions/reservations

  if (sessions.length > 0) {
    const earliest = sessions.reduce((a, b) => {
      if (a.date < b.date) return a
      if (a.date > b.date) return b
      return a.startTime <= b.startTime ? a : b
    })
    logistics.departureTime = earliest.startTime
    if (earliest.deliveryLocation) {
      logistics.departureLocation = earliest.deliveryLocation
    }
  }

  const allProfiles = await ctx.db
    .query('customerProfiles')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
    .collect() // bounded: per-booking sessions/reservations
  const pickupProfile =
    allProfiles.find((p) => p.needsPickup === true) ??
    allProfiles.find((p) => p.pickupTime !== undefined || p.pickupLocation !== undefined)
  if (pickupProfile?.pickupTime) logistics.pickupTime = pickupProfile.pickupTime
  if (pickupProfile?.pickupLocation) logistics.pickupLocation = pickupProfile.pickupLocation

  const bookingResources = await ctx.db
    .query('bookingResources')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
    .collect() // bounded: per-booking sessions/reservations

  const boatResource = bookingResources.find((r) => r.resourceType === 'Boat')
  if (boatResource) {
    if (boatResource.externalName) {
      logistics.boatName = boatResource.externalName
    } else if (boatResource.resourceId) {
      const unit = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_resourceType', (q) =>
          q.eq('ownerId', boatResource.resourceId!).eq('resourceType', 'Boat'),
        )
        .first() // batch-exempt: single first() read for one known boat slug
      if (unit) logistics.boatName = unit.displayName
    }
  }

  return logistics
}
