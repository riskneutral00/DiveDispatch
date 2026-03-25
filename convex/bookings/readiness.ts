/**
 * Booking readiness audit: returns a structured readiness report identifying
 * all unmet conditions blocking Draft-to-Upcoming advancement.
 *
 * DD-067
 */

import { ConvexError, v } from 'convex/values'
import { query } from '../_generated/server'
import type { QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { requireAuth } from '../lib/auth'
import { ErrorCode } from '../lib/errorCodes'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BookingReadiness = {
  isReady: boolean
  checks: {
    bookingFormComplete: boolean
    customerFormComplete: boolean
    medicalClear: boolean
    allReservationsConfirmed: boolean
    noDeclinedResources: boolean
    physicianClearanceValid: boolean
  }
  pendingResources: Array<{
    resourceType: string
    displayName: string
    status: 'PendingAcceptance'
  }>
  declinedResources: Array<{
    resourceType: string
    displayName: string
  }>
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function computeReadiness(
  ctx: QueryCtx,
  booking: Doc<'bookings'>,
): Promise<BookingReadiness> {
  const bookingId = booking._id

  // 1. Form & medical checks
  const bookingFormComplete = booking.bookingFormComplete
  const customerFormComplete = booking.customerFormComplete
  const medicalClear = !booking.medicalHardBlock

  // 2. Query reservations
  const reservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
    .collect()

  // Active = not Vacated (same filter as autoAdvance)
  const active = reservations.filter((r) => r.status !== 'Vacated')

  // Declined = Vacated with stakeholder_declined reason
  const declined = reservations.filter(
    (r) => r.status === 'Vacated' && r.vacatedBy === 'stakeholder_declined',
  )

  const allReservationsConfirmed = active.every((r) => r.status === 'Confirmed')
  const noDeclinedResources = declined.length === 0

  // 3. Physician clearance check
  const customerProfiles = await ctx.db
    .query('customerProfiles')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
    .collect()

  const physicianClearanceValid = customerProfiles.every((p) => {
    if (!p.physicianClearanceRequired) return true
    return p.physicianClearedAt !== undefined
  })

  // 4. Build pending and declined resource arrays by joining to inventoryUnit
  const pendingResources: BookingReadiness['pendingResources'] = []
  for (const r of active) {
    if (r.status === 'PendingAcceptance') {
      const unit = await ctx.db.get(r.inventoryUnitId)
      pendingResources.push({
        resourceType: unit?.resourceType ?? 'Unknown',
        displayName: unit?.displayName ?? 'Unknown',
        status: 'PendingAcceptance',
      })
    }
  }

  const declinedResources: BookingReadiness['declinedResources'] = []
  for (const r of declined) {
    const unit = await ctx.db.get(r.inventoryUnitId)
    declinedResources.push({
      resourceType: unit?.resourceType ?? 'Unknown',
      displayName: unit?.displayName ?? 'Unknown',
    })
  }

  // 5. isReady = all checks true
  const isReady =
    bookingFormComplete &&
    customerFormComplete &&
    medicalClear &&
    allReservationsConfirmed &&
    noDeclinedResources &&
    physicianClearanceValid

  return {
    isReady,
    checks: {
      bookingFormComplete,
      customerFormComplete,
      medicalClear,
      allReservationsConfirmed,
      noDeclinedResources,
      physicianClearanceValid,
    },
    pendingResources,
    declinedResources,
  }
}

// ─── Query ────────────────────────────────────────────────────────────────────

export const getBookingReadiness = query({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args): Promise<BookingReadiness> => {
    const { user } = await requireAuth(ctx)

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

    // Ownership check: caller slug must match booking.ownerId
    if (booking.ownerId !== user.slug) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    return computeReadiness(ctx, booking)
  },
})
