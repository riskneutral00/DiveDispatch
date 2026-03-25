import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import {
  canBookingTransition,
  canReservationTransition,
} from '../convex/bookings/_shared'
import { testDate, testToken } from './helpers/dates'
import { seedUser, seedBooking as _seedBooking, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedBooking(
  ctx: SeedCtx,
  ownerId: string,
  overrides: Parameters<typeof _seedBooking>[1] = {},
) {
  return _seedBooking(ctx, { ownerId, bookingFormComplete: false, ...overrides })
}

// ─── canBookingTransition ─────────────────────────────────────────────────────

describe('canBookingTransition', () => {
  describe('confirm (Draft → Upcoming)', () => {
    it('allows from Draft', () => expect(canBookingTransition('Draft', 'confirm')).toBe(true))
    it('rejects from Upcoming', () => expect(canBookingTransition('Upcoming', 'confirm')).toBe(false))
    it('rejects from Completed', () => expect(canBookingTransition('Completed', 'confirm')).toBe(false))
    it('rejects from Cancelled', () => expect(canBookingTransition('Cancelled', 'confirm')).toBe(false))
  })

  describe('edit (→ Draft)', () => {
    it('allows from Upcoming', () => expect(canBookingTransition('Upcoming', 'edit')).toBe(true))
    it('allows from Completed', () => expect(canBookingTransition('Completed', 'edit')).toBe(true))
    it('rejects from Draft', () => expect(canBookingTransition('Draft', 'edit')).toBe(false))
    it('rejects from Cancelled', () => expect(canBookingTransition('Cancelled', 'edit')).toBe(false))
  })

  describe('cancel (→ Cancelled)', () => {
    it('allows from Draft', () => expect(canBookingTransition('Draft', 'cancel')).toBe(true))
    it('allows from Upcoming', () => expect(canBookingTransition('Upcoming', 'cancel')).toBe(true))
    it('allows from Completed', () => expect(canBookingTransition('Completed', 'cancel')).toBe(true))
    it('rejects from Cancelled (already cancelled)', () => {
      expect(canBookingTransition('Cancelled', 'cancel')).toBe(false)
    })
  })

  describe('complete (Upcoming → Completed)', () => {
    it('allows from Upcoming', () => expect(canBookingTransition('Upcoming', 'complete')).toBe(true))
    it('rejects from Draft', () => expect(canBookingTransition('Draft', 'complete')).toBe(false))
    it('rejects from Completed', () => expect(canBookingTransition('Completed', 'complete')).toBe(false))
    it('rejects from Cancelled', () => expect(canBookingTransition('Cancelled', 'complete')).toBe(false))
  })
})

// ─── canReservationTransition ─────────────────────────────────────────────────

describe('canReservationTransition', () => {
  describe('accept', () => {
    it('allows from PendingAcceptance', () => {
      expect(canReservationTransition('PendingAcceptance', 'accept')).toBe(true)
    })
    it('rejects from Confirmed', () => expect(canReservationTransition('Confirmed', 'accept')).toBe(false))
    it('rejects from Vacated', () => expect(canReservationTransition('Vacated', 'accept')).toBe(false))
    it('rejects from NoShow', () => expect(canReservationTransition('NoShow', 'accept')).toBe(false))
  })

  describe('vacate', () => {
    it('allows from PendingAcceptance', () => {
      expect(canReservationTransition('PendingAcceptance', 'vacate')).toBe(true)
    })
    it('allows from Confirmed', () => expect(canReservationTransition('Confirmed', 'vacate')).toBe(true))
    it('rejects from Vacated', () => expect(canReservationTransition('Vacated', 'vacate')).toBe(false))
    it('rejects from NoShow', () => expect(canReservationTransition('NoShow', 'vacate')).toBe(false))
  })
})

// ─── cancelBooking ────────────────────────────────────────────────────────────

describe('cancelBooking', () => {
  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Draft' })
    })

    await expect(
      t.mutation(api.bookings.status.cancelBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when booking does not exist', async () => {
    const t = makeT()
    // Insert user but no booking — grab a fake id from a dummy insert then delete it
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const id = await seedBooking(ctx, 'owner-slug')
      await ctx.db.delete(id)
      return id
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
        .mutation(api.bookings.status.cancelBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('NOT_FOUND') })
  })

  it('throws FORBIDDEN when caller does not own the booking', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'other-slug', tokenIdentifier: 'clerk|other-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Draft' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|other-slug' })
        .mutation(api.bookings.status.cancelBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('FORBIDDEN') })
  })

  it('throws INVALID_STATUS when booking is already Cancelled', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Cancelled' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
        .mutation(api.bookings.status.cancelBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('INVALID_STATUS') })
  })

  it('cancels a Draft booking — status becomes Cancelled', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Draft' })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Cancelled')
  })

  it('cancels an Upcoming booking and vacates active reservations', async () => {
    const t = makeT()

    const { bookingId, reservationId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Upcoming' })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor One',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })

      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      const snapshotId = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const reservationId = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })

      return { bookingId, reservationId, snapshotId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    const [booking, reservation] = await t.run(async (ctx) => {
      return Promise.all([ctx.db.get(bookingId), ctx.db.get(reservationId)])
    })

    expect(booking!.status).toBe('Cancelled')
    expect(reservation!.status).toBe('Vacated')
    expect(reservation!.vacatedBy).toBe('booking_cancelled')
  })

  it('cancels a Completed booking', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Completed' })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Cancelled')
  })

  it('skips Vacated reservations during cancel', async () => {
    const t = makeT()

    const { bookingId, reservationId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Draft' })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor One',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })

      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      const reservationId = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Vacated',
      })

      return { bookingId, reservationId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    const [booking, reservation] = await t.run(async (ctx) => {
      return Promise.all([ctx.db.get(bookingId), ctx.db.get(reservationId)])
    })

    // Booking is cancelled
    expect(booking!.status).toBe('Cancelled')
    // Already-Vacated reservation stays Vacated (not re-patched with a new vacatedBy)
    expect(reservation!.status).toBe('Vacated')
  })
})

// ─── editBooking ──────────────────────────────────────────────────────────────

describe('editBooking', () => {
  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Upcoming' })
    })

    await expect(
      t.mutation(api.bookings.edit.editBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws INVALID_STATUS when booking is Draft', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Draft' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
        .mutation(api.bookings.edit.editBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('INVALID_STATUS') })
  })

  it('throws INVALID_STATUS when booking is Cancelled', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Cancelled' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
        .mutation(api.bookings.edit.editBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('INVALID_STATUS') })
  })

  it('resets Upcoming booking to Draft and deletes its sessions', async () => {
    const t = makeT()

    const { bookingId, sessionId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Upcoming' })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor One',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })

      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      return { bookingId, sessionId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.edit.editBooking, { bookingId })

    const [booking, session] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(bookingId), ctx.db.get(sessionId)]),
    )

    expect(booking!.status).toBe('Draft')
    expect(booking!.bookingFormComplete).toBe(false)
    expect(session).toBeNull()
  })

  it('resets Completed booking to Draft', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Completed' })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.edit.editBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Draft')
    expect(booking!.bookingFormComplete).toBe(false)
  })

  it('vacates Confirmed reservations with reason operator_edit', async () => {
    const t = makeT()

    const { bookingId, reservationId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Upcoming' })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor One',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })

      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const reservationId = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })

      return { bookingId, reservationId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.edit.editBooking, { bookingId })

    const reservation = await t.run(async (ctx) => ctx.db.get(reservationId))
    expect(reservation!.status).toBe('Vacated')
    expect(reservation!.vacatedBy).toBe('operator_edit')
  })

  it('throws FORBIDDEN when caller does not own the booking', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'other-slug', tokenIdentifier: 'clerk|other-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Upcoming' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|other-slug' })
        .mutation(api.bookings.edit.editBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('FORBIDDEN') })
  })

  // ─── H2: Edit vacates with correct reason + vacatedAt timestamp ──────────

  it('edit vacates all reservations with operator_edit reason and vacatedAt timestamp', async () => {
    const t = makeT()

    const { bookingId, res1Id, res2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Upcoming' })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor One',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })

      const s1 = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      const s2 = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(6),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(6),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const res1Id = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: s1,
        unitsRequested: 1,
        status: 'Confirmed',
      })

      const res2Id = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: s2,
        unitsRequested: 1,
        status: 'PendingAcceptance',
      })

      return { bookingId, res1Id, res2Id }
    })

    const beforeEdit = Date.now()

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.edit.editBooking, { bookingId })

    const [res1, res2] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(res1Id), ctx.db.get(res2Id)]),
    )

    // Both reservations vacated with correct reason
    expect(res1!.status).toBe('Vacated')
    expect(res1!.vacatedBy).toBe('operator_edit')
    expect(res1!.vacatedAt).toBeTypeOf('number')
    expect(res1!.vacatedAt).toBeGreaterThanOrEqual(beforeEdit)

    expect(res2!.status).toBe('Vacated')
    expect(res2!.vacatedBy).toBe('operator_edit')
    expect(res2!.vacatedAt).toBeTypeOf('number')
    expect(res2!.vacatedAt).toBeGreaterThanOrEqual(beforeEdit)
  })

  // ─── H2: Multi-resource edit — Instructor (exclusive) + Boat (pooled) ────

  it('multi-resource edit restores both exclusive and pooled snapshots correctly', async () => {
    const t = makeT()

    const { bookingId, instructorSnapshotId, boatSnapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Upcoming' })

      // Exclusive instructor unit
      const instructorUnitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor One',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })

      // Pooled boat unit with 10 seats total, 2 reserved by this booking
      const boatUnitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-1',
        displayName: 'Day Tripper',
        capacityModel: 'Pooled',
        totalUnits: 10,
        ownerId: 'boat-1',
        ownerType: 'Boat',
      })

      const instructorSessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: instructorUnitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      const boatSessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: boatUnitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      const instructorSnapshotId = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: instructorUnitId,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const boatSnapshotId = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: boatUnitId,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 10,
        reservedUnits: 5,
        availableUnits: 5,
      })

      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: instructorUnitId,
        bookingSessionId: instructorSessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })

      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: boatUnitId,
        bookingSessionId: boatSessionId,
        unitsRequested: 2,
        status: 'Confirmed',
      })

      return { bookingId, instructorSnapshotId, boatSnapshotId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.edit.editBooking, { bookingId })

    const [instructorSnapshot, boatSnapshot] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(instructorSnapshotId), ctx.db.get(boatSnapshotId)]),
    )

    // Exclusive instructor: 0 available + 1 restored = 1 available, 1 reserved - 1 = 0 reserved
    expect(instructorSnapshot!.availableUnits).toBe(1)
    expect(instructorSnapshot!.reservedUnits).toBe(0)

    // Pooled boat: 5 available + 2 restored = 7 available, 5 reserved - 2 = 3 reserved
    expect(boatSnapshot!.availableUnits).toBe(7)
    expect(boatSnapshot!.reservedUnits).toBe(3)
  })

  // ─── H2: Edit clears TTL ─────────────────────────────────────────────────

  it('edit clears expiresAt on the booking', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', {
        status: 'Upcoming',
        expiresAt: Date.now() + 43200000,
        submittedAt: Date.now(),
      })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.edit.editBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Draft')
    expect(booking!.expiresAt).toBeUndefined()
    expect(booking!.submittedAt).toBeUndefined()
  })

  // ─── H2: Edit Upcoming calls releaseBookingReservations ──────────────────

  it('edit Upcoming releases reservations and restores snapshot in same mutation', async () => {
    const t = makeT()

    const { bookingId, reservationId, snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Upcoming' })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor One',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })

      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      const snapshotId = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const reservationId = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })

      return { bookingId, reservationId, snapshotId }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.edit.editBooking, { bookingId })

    const [booking, reservation, snapshot] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(bookingId), ctx.db.get(reservationId), ctx.db.get(snapshotId)]),
    )

    // Booking reverted to Draft
    expect(booking!.status).toBe('Draft')
    // Reservation vacated
    expect(reservation!.status).toBe('Vacated')
    expect(reservation!.vacatedBy).toBe('operator_edit')
    // Snapshot restored atomically
    expect(snapshot!.availableUnits).toBe(1)
    expect(snapshot!.reservedUnits).toBe(0)
  })
})

// ─── H7: Cancellation Side Effects (discardDraft) ───────────────────────────

describe('discardDraft', () => {
  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Draft' })
    })

    await expect(
      t.mutation(api.bookingDraftMutations.discardDraft, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws INVALID_STATUS when booking is Upcoming', async () => {
    const t = makeT()
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      return seedBooking(ctx, 'owner-slug', { status: 'Upcoming' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
        .mutation(api.bookingDraftMutations.discardDraft, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('INVALID_STATUS') })
  })

  // ─── H7: Snapshot restoration on discard ─────────────────────────────────

  it('restores both snapshots when discarding a Draft with 2 active reservations', async () => {
    const t = makeT()

    const { bookingId, snapshot1Id, snapshot2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Draft' })

      const unit1Id = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor One',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })

      const unit2Id = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-1',
        displayName: 'Speed Boat',
        capacityModel: 'Pooled',
        totalUnits: 8,
        ownerId: 'boat-1',
        ownerType: 'Boat',
      })

      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unit1Id,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      const session2Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unit2Id,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      const snapshot1Id = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unit1Id,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const snapshot2Id = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unit2Id,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 8,
        reservedUnits: 3,
        availableUnits: 5,
      })

      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unit1Id,
        bookingSessionId: session1Id,
        unitsRequested: 1,
        status: 'Confirmed',
      })

      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unit2Id,
        bookingSessionId: session2Id,
        unitsRequested: 2,
        status: 'PendingAcceptance',
      })

      return { bookingId, snapshot1Id, snapshot2Id }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookingDraftMutations.discardDraft, { bookingId })

    const [booking, snapshot1, snapshot2] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(bookingId), ctx.db.get(snapshot1Id), ctx.db.get(snapshot2Id)]),
    )

    // Booking hard-deleted
    expect(booking).toBeNull()
    // Exclusive instructor: 0 + 1 = 1 available, 1 - 1 = 0 reserved
    expect(snapshot1!.availableUnits).toBe(1)
    expect(snapshot1!.reservedUnits).toBe(0)
    // Pooled boat: 5 + 2 = 7 available, 3 - 2 = 1 reserved
    expect(snapshot2!.availableUnits).toBe(7)
    expect(snapshot2!.reservedUnits).toBe(1)
  })

  // ─── H7: Session cleanup ─────────────────────────────────────────────────

  it('deletes all sessions when discarding a Draft with 3 sessions', async () => {
    const t = makeT()

    const { bookingId, s1, s2, s3 } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Draft' })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor One',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })

      const s1 = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      const s2 = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(6),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      const s3 = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(7),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      return { bookingId, s1, s2, s3 }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookingDraftMutations.discardDraft, { bookingId })

    const [session1, session2, session3] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(s1), ctx.db.get(s2), ctx.db.get(s3)]),
    )

    expect(session1).toBeNull()
    expect(session2).toBeNull()
    expect(session3).toBeNull()
  })

  // ─── H7: Link cleanup ────────────────────────────────────────────────────

  it('deletes all portal links when discarding a Draft with 2 links', async () => {
    const t = makeT()

    const { bookingId, link1Id, link2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Draft' })

      const link1Id = await ctx.db.insert('bookingLinks', {
        bookingId,
        token: 'tok-alice-001',
        expiresAt: Date.now() + 86400000,
        customerName: 'Alice',
        email: 'alice@test.com',
      })

      const link2Id = await ctx.db.insert('bookingLinks', {
        bookingId,
        token: 'tok-bob-002',
        expiresAt: Date.now() + 86400000,
        customerName: 'Bob',
        email: 'bob@test.com',
      })

      return { bookingId, link1Id, link2Id }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookingDraftMutations.discardDraft, { bookingId })

    const [booking, link1, link2] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(bookingId), ctx.db.get(link1Id), ctx.db.get(link2Id)]),
    )

    expect(booking).toBeNull()
    expect(link1).toBeNull()
    expect(link2).toBeNull()
  })

  // ─── H7: Error atomicity — MISSING_SNAPSHOT aborts entire mutation ───────

  it('does not delete booking when releaseBookingReservations throws MISSING_SNAPSHOT', async () => {
    const t = makeT()

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Draft' })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor One',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })

      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      // Reservation exists but NO availability snapshot — triggers MISSING_SNAPSHOT
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })

      return bookingId
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
        .mutation(api.bookingDraftMutations.discardDraft, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('MISSING_SNAPSHOT') })

    // Booking must NOT be deleted — mutation aborted atomically
    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking).not.toBeNull()
    expect(booking!.status).toBe('Draft')
  })
})

// ─── cancelBooking — additional unit test gaps ───────────────────────────────

describe('cancelBooking — snapshot restoration', () => {
  it('vacates all reservations and restores snapshots end-to-end', async () => {
    const t = makeT()

    const { bookingId, res1Id, res2Id, snap1Id, snap2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Upcoming' })

      const unit1Id = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor One',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })

      const unit2Id = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-1',
        displayName: 'Speed Boat',
        capacityModel: 'Pooled',
        totalUnits: 10,
        ownerId: 'boat-1',
        ownerType: 'Boat',
      })

      const session1Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unit1Id,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      const session2Id = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unit2Id,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      const snap1Id = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unit1Id,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      const snap2Id = await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unit2Id,
        date: testDate(5),
        windowStart: '09:00',
        windowEnd: '11:00',
        totalUnits: 10,
        reservedUnits: 4,
        availableUnits: 6,
      })

      const res1Id = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unit1Id,
        bookingSessionId: session1Id,
        unitsRequested: 1,
        status: 'Confirmed',
      })

      const res2Id = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unit2Id,
        bookingSessionId: session2Id,
        unitsRequested: 3,
        status: 'PendingAcceptance',
      })

      return { bookingId, res1Id, res2Id, snap1Id, snap2Id }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    const [booking, res1, res2, snap1, snap2] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get(bookingId),
        ctx.db.get(res1Id),
        ctx.db.get(res2Id),
        ctx.db.get(snap1Id),
        ctx.db.get(snap2Id),
      ]),
    )

    // Booking cancelled
    expect(booking!.status).toBe('Cancelled')

    // Both reservations vacated with booking_cancelled
    expect(res1!.status).toBe('Vacated')
    expect(res1!.vacatedBy).toBe('booking_cancelled')
    expect(res1!.vacatedAt).toBeTypeOf('number')

    expect(res2!.status).toBe('Vacated')
    expect(res2!.vacatedBy).toBe('booking_cancelled')
    expect(res2!.vacatedAt).toBeTypeOf('number')

    // Exclusive instructor snapshot restored: 0 + 1 = 1, 1 - 1 = 0
    expect(snap1!.availableUnits).toBe(1)
    expect(snap1!.reservedUnits).toBe(0)

    // Pooled boat snapshot restored: 6 + 3 = 9, 4 - 3 = 1
    expect(snap2!.availableUnits).toBe(9)
    expect(snap2!.reservedUnits).toBe(1)
  })
})

// ─── discardDraft orphan cleanup ─────────────────────────────────────────────

describe('discardDraft orphan cleanup', () => {
  it('deletes all customerProfiles linked to the booking', async () => {
    const t = makeT()

    const { bookingId, profile1Id, profile2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Draft' })

      const profile1Id = await ctx.db.insert('customerProfiles', {
        bookingId,
        linkToken: testToken('tok'),
      })
      const profile2Id = await ctx.db.insert('customerProfiles', {
        bookingId,
        linkToken: testToken('tok'),
      })

      return { bookingId, profile1Id, profile2Id }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookingDraftMutations.discardDraft, { bookingId })

    const [profile1, profile2, remaining] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get(profile1Id),
        ctx.db.get(profile2Id),
        ctx.db
          .query('customerProfiles')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
          .collect(),
      ]),
    )

    expect(profile1).toBeNull()
    expect(profile2).toBeNull()
    expect(remaining).toHaveLength(0)
  })

  it('deletes all equipmentBags assigned to the booking', async () => {
    const t = makeT()

    const { bookingId, bag1Id, bag2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Draft' })

      const bag1Id = await ctx.db.insert('equipmentBags', {
        bagNumber: 'BAG-001',
        equipmentManagerId: 'equip-mgr-1',
        bookingId,
        status: 'Assigned',
        assignedAt: Date.now(),
      })
      const bag2Id = await ctx.db.insert('equipmentBags', {
        bagNumber: 'BAG-002',
        equipmentManagerId: 'equip-mgr-1',
        bookingId,
        status: 'InUse',
        assignedAt: Date.now(),
      })

      return { bookingId, bag1Id, bag2Id }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookingDraftMutations.discardDraft, { bookingId })

    const [bag1, bag2, remaining] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get(bag1Id),
        ctx.db.get(bag2Id),
        ctx.db
          .query('equipmentBags')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
          .collect(),
      ]),
    )

    expect(bag1).toBeNull()
    expect(bag2).toBeNull()
    expect(remaining).toHaveLength(0)
  })

  it('hard-deletes vacated reservations left from a prior edit cycle', async () => {
    const t = makeT()

    const { bookingId, res1Id, res2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, { slug: 'owner-slug', tokenIdentifier: 'clerk|owner-slug', role: 'DiveCenter' })
      const bookingId = await seedBooking(ctx, 'owner-slug', { status: 'Draft' })

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: 'instructor-1',
        displayName: 'Instructor One',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: 'instructor-1',
        ownerType: 'Instructor',
      })

      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'Asia/Bangkok',
      })

      // Vacated reservations from a prior edit cycle — status already Vacated
      const res1Id = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Vacated',
        vacatedBy: 'operator_edit',
        vacatedAt: Date.now() - 60_000,
      })
      const res2Id = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Vacated',
        vacatedBy: 'operator_edit',
        vacatedAt: Date.now() - 30_000,
      })

      return { bookingId, res1Id, res2Id }
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookingDraftMutations.discardDraft, { bookingId })

    const [res1, res2, remaining] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get(res1Id),
        ctx.db.get(res2Id),
        ctx.db
          .query('reservations')
          .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
          .collect(),
      ]),
    )

    expect(res1).toBeNull()
    expect(res2).toBeNull()
    expect(remaining).toHaveLength(0)
  })
})
