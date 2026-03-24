/**
 * Auto-advance logic: promotes Draft bookings to Upcoming when all conditions
 * are simultaneously satisfied. Includes EM auto-release.
 * Extracted from _shared.ts (L8-24).
 */

import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { getResourcesForBooking } from '../bookingResources'
import { restoreSnapshotUnits } from './inventoryRelease'

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
  if (!booking || booking.status !== 'Draft') return
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
        if (res.status === 'Vacated' || res.status === 'NoShow') continue
        const unit = await ctx.db.get(res.inventoryUnitId)
        if (!unit || unit.resourceType !== 'Equipment') continue

        await ctx.db.patch(res._id, {
          status: 'Vacated',
          vacatedAt: Date.now(),
          vacatedBy: 'equipment_not_needed',
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
            await restoreSnapshotUnits(ctx, snapshot._id, snapshot.availableUnits, snapshot.reservedUnits, res.unitsRequested)
          }
        }
      }
    }
  }

  // ─── Reservation check ────────────────────────────────────────────────────
  const reservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .collect()

  const active = reservations.filter((r) => r.status !== 'Vacated')
  // A declined resource (stakeholder_declined) means the booking is missing a required
  // resource and cannot advance. Vacated-for-other-reasons (equipment_not_needed) is fine.
  const hasDeclinedResource = reservations.some(
    (r) => r.status === 'Vacated' && r.vacatedBy === 'stakeholder_declined',
  )

  // All in-system reservations must be Confirmed.
  // Vacuously true when ALL resources are external (zero reservations ever created).
  // Blocked when a required resource was declined (needs operator attention).
  const allConfirmed = active.every((r) => r.status === 'Confirmed')

  if (allConfirmed && !hasDeclinedResource) {
    await ctx.db.patch(bookingId as Id<'bookings'>, { status: 'Upcoming' })
  }
}
