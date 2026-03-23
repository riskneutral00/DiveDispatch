import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import {
  canBookingTransition,
  canReservationTransition,
} from '../convex/bookings/_shared'
import { testDate } from './helpers/dates'

const modules = import.meta.glob('../convex/**/*.ts')

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedUser(
  ctx: Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0],
  slug: string,
  role: string = 'DiveCenter',
) {
  await ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test Biz',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: role as any,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

async function seedBooking(
  ctx: Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0],
  ownerId: string,
  overrides: Record<string, unknown> = {},
) {
  return ctx.db.insert('bookings', {
    ownerId,
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: 43200000,
    paid: false,
    activityType: ['OW'],
    startDate: testDate(5),
    endDate: testDate(7),
    divers: [{ name: 'Alice', abbrev: 'A', flag: { code: 'TH', label: 'Thailand' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] }],
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(overrides as any),
  })
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
    const t = convexTest(schema, modules)
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
      return seedBooking(ctx, 'owner-slug', { status: 'Draft' })
    })

    await expect(
      t.mutation(api.bookings.status.cancelBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws NOT_FOUND when booking does not exist', async () => {
    const t = convexTest(schema, modules)
    // Insert user but no booking — grab a fake id from a dummy insert then delete it
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
    const t = convexTest(schema, modules)
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'other-slug')
      return seedBooking(ctx, 'owner-slug', { status: 'Draft' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|other-slug' })
        .mutation(api.bookings.status.cancelBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('FORBIDDEN') })
  })

  it('throws INVALID_STATUS when booking is already Cancelled', async () => {
    const t = convexTest(schema, modules)
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
      return seedBooking(ctx, 'owner-slug', { status: 'Cancelled' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
        .mutation(api.bookings.status.cancelBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('INVALID_STATUS') })
  })

  it('cancels a Draft booking — status becomes Cancelled', async () => {
    const t = convexTest(schema, modules)
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
      return seedBooking(ctx, 'owner-slug', { status: 'Draft' })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Cancelled')
  })

  it('cancels an Upcoming booking and vacates active reservations', async () => {
    const t = convexTest(schema, modules)

    const { bookingId, reservationId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
    const t = convexTest(schema, modules)
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
      return seedBooking(ctx, 'owner-slug', { status: 'Completed' })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.status.cancelBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Cancelled')
  })

  it('skips Vacated reservations during cancel', async () => {
    const t = convexTest(schema, modules)

    const { bookingId, reservationId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
    const t = convexTest(schema, modules)
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
      return seedBooking(ctx, 'owner-slug', { status: 'Upcoming' })
    })

    await expect(
      t.mutation(api.bookings.edit.editBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws INVALID_STATUS when booking is Draft', async () => {
    const t = convexTest(schema, modules)
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
      return seedBooking(ctx, 'owner-slug', { status: 'Draft' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
        .mutation(api.bookings.edit.editBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('INVALID_STATUS') })
  })

  it('throws INVALID_STATUS when booking is Cancelled', async () => {
    const t = convexTest(schema, modules)
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
      return seedBooking(ctx, 'owner-slug', { status: 'Cancelled' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
        .mutation(api.bookings.edit.editBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('INVALID_STATUS') })
  })

  it('resets Upcoming booking to Draft and deletes its sessions', async () => {
    const t = convexTest(schema, modules)

    const { bookingId, sessionId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
    const t = convexTest(schema, modules)
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
      return seedBooking(ctx, 'owner-slug', { status: 'Completed' })
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
      .mutation(api.bookings.edit.editBooking, { bookingId })

    const booking = await t.run(async (ctx) => ctx.db.get(bookingId))
    expect(booking!.status).toBe('Draft')
    expect(booking!.bookingFormComplete).toBe(false)
  })

  it('vacates Confirmed reservations with reason operator_edit', async () => {
    const t = convexTest(schema, modules)

    const { bookingId, reservationId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
    const t = convexTest(schema, modules)
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'other-slug')
      return seedBooking(ctx, 'owner-slug', { status: 'Upcoming' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|other-slug' })
        .mutation(api.bookings.edit.editBooking, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('FORBIDDEN') })
  })

  // ─── H2: Edit vacates with correct reason + vacatedAt timestamp ──────────

  it('edit vacates all reservations with operator_edit reason and vacatedAt timestamp', async () => {
    const t = convexTest(schema, modules)

    const { bookingId, res1Id, res2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
    const t = convexTest(schema, modules)

    const { bookingId, instructorSnapshotId, boatSnapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
    const t = convexTest(schema, modules)

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
    const t = convexTest(schema, modules)

    const { bookingId, reservationId, snapshotId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
    const t = convexTest(schema, modules)
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
      return seedBooking(ctx, 'owner-slug', { status: 'Draft' })
    })

    await expect(
      t.mutation(api.bookingDraftMutations.discardDraft, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws INVALID_STATUS when booking is Upcoming', async () => {
    const t = convexTest(schema, modules)
    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
      return seedBooking(ctx, 'owner-slug', { status: 'Upcoming' })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|owner-slug' })
        .mutation(api.bookingDraftMutations.discardDraft, { bookingId }),
    ).rejects.toMatchObject({ data: expect.stringContaining('INVALID_STATUS') })
  })

  // ─── H7: Snapshot restoration on discard ─────────────────────────────────

  it('restores both snapshots when discarding a Draft with 2 active reservations', async () => {
    const t = convexTest(schema, modules)

    const { bookingId, snapshot1Id, snapshot2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
    const t = convexTest(schema, modules)

    const { bookingId, s1, s2, s3 } = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
    const t = convexTest(schema, modules)

    const { bookingId, link1Id, link2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
    const t = convexTest(schema, modules)

    const bookingId = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
    const t = convexTest(schema, modules)

    const { bookingId, res1Id, res2Id, snap1Id, snap2Id } = await t.run(async (ctx) => {
      await seedUser(ctx, 'owner-slug')
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
