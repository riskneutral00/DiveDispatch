/**
 * DD-067: Booking readiness audit
 *
 * Tests the getBookingReadiness query that returns a structured readiness
 * report identifying all unmet conditions blocking Draft-to-Upcoming advancement.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedBooking,
  seedInventoryUnit,
  seedSession,
  seedReservation,
  seedCustomerProfile,
} from './fixtures'

describe('getBookingReadiness', () => {
  // ─── 1. All conditions met → isReady: true ──────────────────────────────────

  it('returns isReady true when all conditions are met (no reservations)', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      return seedBooking(ctx, {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.bookings.readiness.getBookingReadiness, { bookingId })

    expect(result.isReady).toBe(true)
    expect(result.checks.bookingFormComplete).toBe(true)
    expect(result.checks.customerFormComplete).toBe(true)
    expect(result.checks.medicalClear).toBe(true)
    expect(result.checks.allReservationsConfirmed).toBe(true)
    expect(result.checks.noDeclinedResources).toBe(true)
    expect(result.checks.physicianClearanceValid).toBe(true)
    expect(result.pendingResources).toEqual([])
    expect(result.declinedResources).toEqual([])
  })

  it('returns isReady true when all reservations are Confirmed', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bId = await seedBooking(ctx, {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'John Instructor',
      })
      const sessionId = await seedSession(ctx, bId, unitId)
      await seedReservation(ctx, bId, unitId, sessionId, { status: 'Confirmed' })
      return bId
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.bookings.readiness.getBookingReadiness, { bookingId })

    expect(result.isReady).toBe(true)
    expect(result.checks.allReservationsConfirmed).toBe(true)
    expect(result.pendingResources).toEqual([])
  })

  // ─── 2. PendingAcceptance reservation → isReady: false ──────────────────────

  it('returns isReady false with PendingAcceptance reservation', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bId = await seedBooking(ctx, {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Pending Instructor',
      })
      const sessionId = await seedSession(ctx, bId, unitId)
      await seedReservation(ctx, bId, unitId, sessionId, { status: 'PendingAcceptance' })
      return bId
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.bookings.readiness.getBookingReadiness, { bookingId })

    expect(result.isReady).toBe(false)
    expect(result.checks.allReservationsConfirmed).toBe(false)
    expect(result.pendingResources).toHaveLength(1)
    expect(result.pendingResources[0]).toEqual({
      resourceType: 'Instructor',
      displayName: 'Pending Instructor',
      status: 'PendingAcceptance',
    })
  })

  // ─── 3. medicalHardBlock → isReady: false ───────────────────────────────────

  it('returns isReady false when medicalHardBlock is true', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      return seedBooking(ctx, {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: true,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.bookings.readiness.getBookingReadiness, { bookingId })

    expect(result.isReady).toBe(false)
    expect(result.checks.medicalClear).toBe(false)
  })

  // ─── 4. Non-owner caller → FORBIDDEN ────────────────────────────────────────

  it('throws FORBIDDEN for non-owner caller', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx) // DC owner
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.other,
        slug: TEST_SLUGS.other,
        role: 'DiveCenter',
      })
      return seedBooking(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        bookingFormComplete: true,
        customerFormComplete: true,
      })
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.other })
        .query(api.bookings.readiness.getBookingReadiness, { bookingId }),
      'FORBIDDEN',
    )
  })

  // ─── 5. bookingFormComplete false → isReady: false ──────────────────────────

  it('returns isReady false when bookingFormComplete is false', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      return seedBooking(ctx, {
        bookingFormComplete: false,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.bookings.readiness.getBookingReadiness, { bookingId })

    expect(result.isReady).toBe(false)
    expect(result.checks.bookingFormComplete).toBe(false)
  })

  // ─── 6. customerFormComplete false → isReady: false ─────────────────────────

  it('returns isReady false when customerFormComplete is false', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      return seedBooking(ctx, {
        bookingFormComplete: true,
        customerFormComplete: false,
        medicalHardBlock: false,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.bookings.readiness.getBookingReadiness, { bookingId })

    expect(result.isReady).toBe(false)
    expect(result.checks.customerFormComplete).toBe(false)
  })

  // ─── 7. Declined resource → isReady: false ─────────────────────────────────

  it('returns isReady false with a declined resource', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bId = await seedBooking(ctx, {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        displayName: 'Declined Boat',
        ownerId: 'boat-owner',
        ownerType: 'Boat',
      })
      const sessionId = await seedSession(ctx, bId, unitId)
      // Insert a Vacated reservation with stakeholder_declined reason
      await ctx.db.insert('reservations', {
        bookingId: bId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Vacated',
        vacatedAt: Date.now(),
        vacatedBy: 'stakeholder_declined',
      })
      return bId
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.bookings.readiness.getBookingReadiness, { bookingId })

    expect(result.isReady).toBe(false)
    expect(result.checks.noDeclinedResources).toBe(false)
    expect(result.declinedResources).toHaveLength(1)
    expect(result.declinedResources[0]).toEqual({
      resourceType: 'Boat',
      displayName: 'Declined Boat',
    })
  })

  // ─── 8. Vacated (non-declined) reservations are ignored ─────────────────────

  it('ignores Vacated reservations that are not stakeholder_declined', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bId = await seedBooking(ctx, {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Equipment',
        displayName: 'Released Equipment',
        ownerId: 'em-slug',
        ownerType: 'Equipment',
      })
      const sessionId = await seedSession(ctx, bId, unitId)
      await ctx.db.insert('reservations', {
        bookingId: bId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Vacated',
        vacatedAt: Date.now(),
        vacatedBy: 'equipment_not_needed',
      })
      return bId
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.bookings.readiness.getBookingReadiness, { bookingId })

    expect(result.isReady).toBe(true)
    expect(result.checks.noDeclinedResources).toBe(true)
    expect(result.declinedResources).toEqual([])
  })

  // ─── 9. Physician clearance required but not provided → isReady: false ──────

  it('returns isReady false when physician clearance required but not provided', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bId = await seedBooking(ctx, {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      await seedCustomerProfile(ctx, bId, {
        physicianClearanceRequired: true,
        // physicianClearedAt not set
      })
      return bId
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.bookings.readiness.getBookingReadiness, { bookingId })

    expect(result.isReady).toBe(false)
    expect(result.checks.physicianClearanceValid).toBe(false)
  })

  // ─── 10. Physician clearance required and provided → check passes ───────────

  it('returns physicianClearanceValid true when clearance is provided', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bId = await seedBooking(ctx, {
        bookingFormComplete: true,
        customerFormComplete: true,
        medicalHardBlock: false,
      })
      await seedCustomerProfile(ctx, bId, {
        physicianClearanceRequired: true,
        physicianClearedAt: Date.now(),
      })
      return bId
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.bookings.readiness.getBookingReadiness, { bookingId })

    expect(result.isReady).toBe(true)
    expect(result.checks.physicianClearanceValid).toBe(true)
  })

  // ─── 11. Multiple failures: all checks reported correctly ───────────────────

  it('reports multiple failing checks simultaneously', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bId = await seedBooking(ctx, {
        bookingFormComplete: false,
        customerFormComplete: false,
        medicalHardBlock: true,
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Instructor',
        displayName: 'Pending Instructor',
      })
      const sessionId = await seedSession(ctx, bId, unitId)
      await seedReservation(ctx, bId, unitId, sessionId, { status: 'PendingAcceptance' })
      return bId
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.bookings.readiness.getBookingReadiness, { bookingId })

    expect(result.isReady).toBe(false)
    expect(result.checks.bookingFormComplete).toBe(false)
    expect(result.checks.customerFormComplete).toBe(false)
    expect(result.checks.medicalClear).toBe(false)
    expect(result.checks.allReservationsConfirmed).toBe(false)
  })

  // ─── 12. NOT_FOUND for nonexistent booking ─────────────────────────────────

  it('throws NOT_FOUND for nonexistent booking', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx)
      const bId = await seedBooking(ctx)
      await ctx.db.delete(bId)
      return bId
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
        .query(api.bookings.readiness.getBookingReadiness, { bookingId }),
      'NOT_FOUND',
    )
  })
})
