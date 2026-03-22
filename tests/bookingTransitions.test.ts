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
})
