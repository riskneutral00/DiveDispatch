/**
 * Auto-advance logic: promotes Draft bookings to Upcoming when all conditions
 * are simultaneously satisfied. Includes EM auto-release.
 * Extracted from _shared.ts (L8-24).
 */

import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { getResourcesForBooking } from '../bookingResources'
import { restoreSnapshotUnits } from './inventoryRelease'
import { BOOKING_STATUS, RESERVATION_STATUS, VACATED_REASON } from '../shared/statuses'

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
        .collect()

      for (const res of allReservations) {
        if (res.status === RESERVATION_STATUS.Vacated || res.status === RESERVATION_STATUS.NoShow) continue
        // DD-017: re-read reservation to guard against concurrent vacate
        const fresh = await ctx.db.get(res._id)
        if (!fresh || fresh.status === RESERVATION_STATUS.Vacated) continue
        const unit = await ctx.db.get(res.inventoryUnitId)
        if (!unit || unit.resourceType !== 'Equipment') continue

        await ctx.db.patch(res._id, {
          status: RESERVATION_STATUS.Vacated,
          vacatedAt: Date.now(),
          vacatedBy: VACATED_REASON.EquipmentNotNeeded,
        })

        // Restore availability snapshot — same pattern as releaseBookingReservations
        const session = await ctx.db.get(res.bookingSessionId)
        if (session) {
          const snapshot = await ctx.db
            .query('availabilitySnapshots')
            .withIndex('by_inventoryUnitId_date_windowStart', (q) =>
              q
                .eq('inventoryUnitId', res.inventoryUnitId)
                .eq('date', session.date)
                .eq('windowStart', session.startTime),
            )
            .unique()
          if (snapshot) {
            await restoreSnapshotUnits(ctx, snapshot._id, res.unitsRequested)
          }
        }
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
    .collect()

  const active = reservations.filter((r) => r.status !== RESERVATION_STATUS.Vacated)
  // A declined resource (stakeholder_declined) means the booking is missing a required
  // resource and cannot advance. Vacated-for-other-reasons (equipment_not_needed) is fine.
  const hasDeclinedResource = reservations.some(
    (r) => r.status === RESERVATION_STATUS.Vacated && r.vacatedBy === VACATED_REASON.StakeholderDeclined,
  )

  // All in-system reservations must be Confirmed.
  // Vacuously true when ALL resources are external (zero reservations ever created).
  // Blocked when a required resource was declined (needs operator attention).
  const allConfirmed = active.every((r) => r.status === RESERVATION_STATUS.Confirmed)

  if (allConfirmed && !hasDeclinedResource) {
    await ctx.db.patch(bookingId as Id<'bookings'>, { status: BOOKING_STATUS.Upcoming })
  }
}
