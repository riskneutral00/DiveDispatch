/**
 * Auto-advance logic: promotes Draft bookings to Upcoming when all conditions
 * are simultaneously satisfied. Includes EM auto-release.
 * Extracted from _shared.ts (L8-24).
 */

import { ConvexError } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { getResourcesForBooking } from '../bookingResources'
import { restoreSnapshotUnits, getAvailabilitySnapshot } from './inventoryRelease'
import { BOOKING_STATUS, RESERVATION_STATUS, VACATED_REASON, NOTIFICATION_TYPE } from '../shared/statuses'
import { ErrorCode } from '../lib/errorCodes'
import { notify } from '../notifications'
import type { NotificationLogistics } from '../shared/notificationLogistics'

/**
 * Advances booking Draft → Upcoming when all conditions are simultaneously satisfied.
 * Silent no-op if any condition is unmet — callers never need to check.
 *
 * All-external bookings (zero in-system reservations) satisfy the reservation condition
 * vacuously — `[].every(fn)` is true — and advance immediately when form conditions are met.
 *
 * EM auto-release: if every customer profile has submitted a rentalChecklist with all
 * gear set to 'own', the Equipment Manager reservation is vacated automatically —
 * their services are not needed. This runs before the reservation confirmation check
 * so the now-vacated EM slot does not block advancement.
 */
export async function tryAutoAdvance(ctx: MutationCtx, bookingId: string): Promise<void> {
  const booking = await ctx.db.get(bookingId as Id<'bookings'>)
  if (!booking || booking.status !== BOOKING_STATUS.Draft) return
  if (!booking.bookingFormComplete || !booking.customerFormComplete) return
  if (booking.medicalHardBlock) return

  // ─── EM auto-release ──────────────────────────────────────────────────────
  // Release the EM reservation when every customer owns all their gear.
  // Requires: booking has an in-system EM, all customer profiles have submitted
  // rentalChecklist, and every gear type is 'own'. Missing checklist → keep hold.
  const bookingResourceRows = await getResourcesForBooking(ctx, bookingId)
  const hasInSystemEM = bookingResourceRows.some(
    (r: { resourceType: string; resourceSlug?: string }) =>
      r.resourceType === 'Equipment' && r.resourceSlug,
  )
  if (hasInSystemEM) {
    const profiles = await ctx.db
      .query('customerProfiles')
      .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
      .collect()

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

      // DD-291: seenSnapshotIds prevents double-patching when two reservations share a snapshot
      const seenSnapshotIds = new Set<string>()
      for (const res of allReservations) {
        if (res.status === RESERVATION_STATUS.Vacated || res.status === RESERVATION_STATUS.NoShow) continue
        // DD-017: re-read reservation to guard against concurrent vacate
        const fresh = await ctx.db.get(res._id) // batch-exempt: guard read per-reservation, sequential intentional
        if (!fresh || fresh.status === RESERVATION_STATUS.Vacated) continue
        const unit = await ctx.db.get(res.inventoryUnitId) // batch-exempt: conditional check per reservation
        if (!unit || unit.resourceType !== 'Equipment') continue

        // Fetch session + snapshot BEFORE patching reservation (Invariant 3: paired writes)
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

  // DD-017: re-read booking after EM auto-release to guard against concurrent status change
  const freshBooking = await ctx.db.get(bookingId as Id<'bookings'>)
  if (!freshBooking || freshBooking.status !== BOOKING_STATUS.Draft) return

  // ─── Reservation check ────────────────────────────────────────────────────
  const reservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .take(100)

  const active = reservations.filter(
    (r) => r.status !== RESERVATION_STATUS.Vacated && r.status !== RESERVATION_STATUS.NoShow,
  )
  // A declined or date-blocked resource means the booking is missing a required
  // resource and cannot advance. Vacated-for-other-reasons (equipment_not_needed) is fine.
  const hasMissingResource = reservations.some(
    (r) =>
      r.status === RESERVATION_STATUS.Vacated &&
      (r.vacatedBy === VACATED_REASON.StakeholderDeclined ||
        r.vacatedBy === VACATED_REASON.DateBlocked),
  )

  // All in-system reservations must be Confirmed.
  // Vacuously true when ALL resources are external (zero reservations ever created).
  // Blocked when a required resource was declined or date-blocked (needs operator attention).
  const allConfirmed = active.every((r) => r.status === RESERVATION_STATUS.Confirmed)

  if (allConfirmed && !hasMissingResource) {
    await ctx.db.patch(bookingId as Id<'bookings'>, { status: BOOKING_STATUS.Upcoming })

    let logistics: NotificationLogistics | undefined
    try {
      logistics = await collectLogistics(ctx, bookingId as Id<'bookings'>)
    } catch {
      // collectLogistics is best-effort — notification proceeds without logistics
    }
    await notify(ctx, {
      userId: freshBooking.ownerId,
      type: NOTIFICATION_TYPE.BookingConfirmed,
      bookingId: bookingId as Id<'bookings'>,
      message: 'Your booking is confirmed.',
      logistics,
    })
  }
}

/**
 * Collects logistics details for a booking_confirmed notification.
 * Sources:
 *   - departureTime: earliest session startTime
 *   - departureLocation: deliveryLocation from earliest session (if set)
 *   - pickupTime/pickupLocation: first customerProfile with pickup data
 *   - boatName: Boat bookingResource externalName or inventory unit displayName
 *
 * Returns an object with only the fields that are present — no undefined values in the object.
 */
async function collectLogistics(
  ctx: MutationCtx,
  bookingId: Id<'bookings'>,
): Promise<NotificationLogistics> {
  const logistics: NotificationLogistics = {}

  // Departure time + location from earliest booking session
  const sessions = await ctx.db
    .query('bookingSessions')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
    .collect()

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

  // Pickup details: in multi-diver bookings multiple profiles share the same
  // bookingId. Prefer the first profile with needsPickup === true; fall back to
  // the first profile that has pickupTime or pickupLocation set. If none have
  // any pickup data, no pickup fields are added to logistics.
  const allProfiles = await ctx.db
    .query('customerProfiles')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
    .collect()
  const pickupProfile =
    allProfiles.find((p) => p.needsPickup === true) ??
    allProfiles.find((p) => p.pickupTime !== undefined || p.pickupLocation !== undefined)
  if (pickupProfile?.pickupTime) logistics.pickupTime = pickupProfile.pickupTime
  if (pickupProfile?.pickupLocation) logistics.pickupLocation = pickupProfile.pickupLocation

  // Boat name from bookingResources
  const bookingResources = await ctx.db
    .query('bookingResources')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
    .collect()

  const boatResource = bookingResources.find((r) => r.resourceType === 'Boat')
  if (boatResource) {
    if (boatResource.externalName) {
      logistics.boatName = boatResource.externalName
    } else if (boatResource.resourceSlug) {
      // In-system boat: look up inventory unit displayName
      const unit = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_resourceType', (q) =>
          q.eq('ownerId', boatResource.resourceSlug!).eq('resourceType', 'Boat'),
        )
        .first() // batch-exempt: single first() read for one known boat slug
      if (unit) logistics.boatName = unit.displayName
    }
  }

  return logistics
}
