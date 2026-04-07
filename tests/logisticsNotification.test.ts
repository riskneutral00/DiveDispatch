/**
 * DD-360: Structured logistics in notifications.
 *
 * Tests:
 * 1. booking → Upcoming emits booking_confirmed notification to owner with logistics
 * 2. logistics fields populated from session startTime, customerProfile pickup, and boat resource
 * 3. logistics absent when no session data exists (minimal booking)
 * 4. notifications without logistics field are unaffected by schema change
 * 5. notify() stores logistics payload when provided
 * 6. notify() omits logistics key when not provided (backward compat)
 * 7. multi-role: DiveCenter, Agent, and Liveaboard bookings all emit confirmed notification
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { notify } from '../convex/notifications'
import { tryAutoAdvance } from '../convex/bookings/_shared'
import { NOTIFICATION_TYPE, RESERVATION_STATUS, VACATED_REASON } from '../convex/shared/statuses'
import type { Id, TableNames } from '../convex/_generated/dataModel'
import { testDate } from './helpers/dates'
import { TEST_SLUGS, seedUser, seedNotification } from './fixtures'
import { makeT } from './helpers/convex-helpers'
import { HOLD_TTL_MS } from '../convex/lib/auth'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── Helper: seed a fully-confirmed booking that should auto-advance ──────────

async function seedConfirmedBooking(
  ctx: Parameters<Parameters<typeof t.run>[0]>[0],
  ownerId: string,
  ownerType: 'DiveCenter' | 'Agent' | 'Liveaboard' = 'DiveCenter',
): Promise<Id<'bookings'>> {
  return ctx.db.insert('bookings', {
    ownerId,
    ownerType,
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL_MS,
    paid: false,
    activityType: ['OW'],
    startDate: testDate(5),
    endDate: testDate(7),
    divers: [
      {
        name: 'Alice',
        abbrev: 'AL',
        flag: { code: 'TH', label: 'Thailand' },
        startDate: testDate(5),
        endDate: testDate(7),
        activityType: ['OW'],
      },
    ],
    operatorName: 'Test Operator',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: true,
    customerFormComplete: true,
  })
}

// ─── notify() logistics storage ───────────────────────────────────────────────

describe('notify() with logistics payload', () => {
  it('stores logistics when provided', async () => {
    await t.run(async (ctx) => {
      await notify(ctx, {
        userId: TEST_SLUGS.diveCenter,
        type: NOTIFICATION_TYPE.BookingConfirmed,
        message: 'Your booking is confirmed.',
        logistics: {
          pickupTime: '07:30',
          pickupLocation: 'Hotel lobby',
          departureTime: '08:00',
          departureLocation: 'Main pier',
          boatName: 'MV Sea Rider',
          meetingPoint: 'Pier 1, Gate A',
        },
      })

      const notifications = await ctx.db.query('notifications').collect()
      expect(notifications).toHaveLength(1)
      expect(notifications[0].logistics).toEqual({
        pickupTime: '07:30',
        pickupLocation: 'Hotel lobby',
        departureTime: '08:00',
        departureLocation: 'Main pier',
        boatName: 'MV Sea Rider',
        meetingPoint: 'Pier 1, Gate A',
      })
    })
  })

  it('omits logistics key entirely when not provided', async () => {
    await t.run(async (ctx) => {
      await notify(ctx, {
        userId: TEST_SLUGS.diveCenter,
        type: NOTIFICATION_TYPE.HoldPlaced,
        message: 'Hold placed.',
      })

      const notifications = await ctx.db.query('notifications').collect()
      expect(notifications).toHaveLength(1)
      expect(notifications[0].logistics).toBeUndefined()
    })
  })

  it('allows partial logistics (some fields optional)', async () => {
    await t.run(async (ctx) => {
      await notify(ctx, {
        userId: TEST_SLUGS.diveCenter,
        type: NOTIFICATION_TYPE.BookingConfirmed,
        message: 'Your booking is confirmed.',
        logistics: {
          departureTime: '08:00',
        },
      })

      const notifications = await ctx.db.query('notifications').collect()
      expect(notifications[0].logistics).toMatchObject({ departureTime: '08:00' })
      expect(notifications[0].logistics?.pickupTime).toBeUndefined()
    })
  })
})

// ─── seedNotification backward compat ─────────────────────────────────────────

describe('existing notifications without logistics', () => {
  it('are unaffected — logistics remains undefined', async () => {
    await t.withIdentity({ tokenIdentifier: 'test|dc-user' }).run(async (ctx) => {
      await seedUser(ctx)
      const notifId = await seedNotification(ctx, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
      })

      const notif = await ctx.db.get(notifId)
      expect(notif?.message).toBe('Test notification')
      expect(notif?.logistics).toBeUndefined()
    })
  })
})

// ─── tryAutoAdvance emits booking_confirmed notification ─────────────────────

describe('tryAutoAdvance logistics notification', () => {
  it('emits booking_confirmed notification to operator when booking advances to Upcoming', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      await tryAutoAdvance(ctx, bookingId)

      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Upcoming')

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.userId).toBe(TEST_SLUGS.diveCenter)
      expect(confirmed?.bookingId).toEqual(bookingId)
    })
  })

  it('populates departureTime from first booking session when present', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      // Seed an inventory unit and session
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: TEST_SLUGS.instructor,
        displayName: 'John Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: TEST_SLUGS.instructor,
        ownerType: 'Instructor',
      })
      await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })

      // Confirm reservation so advance succeeds
      const sessionId = (await ctx.db
        .query('bookingSessions')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
        .first())!._id
      const resId = await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })
      // Need snapshot for the reservation to exist properly
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })
      void resId

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.departureTime).toBe('08:00')
    })
  })

  it('populates pickupTime and pickupLocation from customerProfile when present', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      // Seed customerProfile with pickup info
      await ctx.db.insert('customerProfiles', {
        bookingId,
        linkToken: 'tok-1',
        needsPickup: true,
        pickupTime: '07:30',
        pickupLocation: 'Beach Road Hotel',
      })

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.pickupTime).toBe('07:30')
      expect(confirmed?.logistics?.pickupLocation).toBe('Beach Road Hotel')
    })
  })

  it('populates boatName from Boat bookingResource externalName when present', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      // External boat resource
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Boat',
        externalName: 'MV Ocean Spirit',
      })

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.boatName).toBe('MV Ocean Spirit')
    })
  })

  it('populates boatName from inventoryUnit.displayName for in-system boat (resourceId set)', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      const boatSlug = 'sea-rider-boat-co'

      // Seed the inventory unit for the in-system boat
      await ctx.db.insert('inventoryUnits', {
        resourceType: 'Boat',
        resourceId: 'boat-unit-1',
        displayName: 'MV Sea Rider',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: boatSlug,
        ownerType: 'Boat',
      })

      // Seed in-system boat resource (resourceId set, no externalName)
      await ctx.db.insert('bookingResources', {
        bookingId,
        resourceType: 'Boat',
        resourceId: boatSlug,
      })

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.boatName).toBe('MV Sea Rider')
    })
  })

  it('emits confirmed notification without boatName when no boat bookingResource exists', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      // No bookingResources inserted — no boat at all
      await tryAutoAdvance(ctx, bookingId)

      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Upcoming')

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed).toBeDefined()
      expect(confirmed?.type).toBe(NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.boatName).toBeUndefined()
    })
  })

  it('emits confirmed notification for Agent-owned booking (multi-role)', async () => {
    await t.run(async (ctx) => {
      const agentSlug = 'travel-agent-co'
      const bookingId = await seedConfirmedBooking(ctx, agentSlug, 'Agent')

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.userId).toBe(agentSlug)
    })
  })

  it('emits confirmed notification for Liveaboard-owned booking (multi-role)', async () => {
    await t.run(async (ctx) => {
      const liveaboardSlug = 'mv-pacific-star'
      const bookingId = await seedConfirmedBooking(ctx, liveaboardSlug, 'Liveaboard')

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.userId).toBe(liveaboardSlug)
    })
  })

  it('does not emit confirmed notification when booking stays Draft (conditions unmet)', async () => {
    await t.run(async (ctx) => {
      // booking not form-complete → stays Draft
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: TEST_SLUGS.diveCenter,
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL_MS,
        paid: false,
        activityType: ['OW'],
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [
          {
            name: 'Alice',
            abbrev: 'AL',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(7),
            activityType: ['OW'],
          },
        ],
        operatorName: 'Test DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false, // not complete
        customerFormComplete: false,
      })

      await tryAutoAdvance(ctx, bookingId)

      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Draft')

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed).toBeUndefined()
    })
  })
})

// ─── DD-421: collectLogistics filters by needsPickup:true ────────────────────

describe('collectLogistics pickup profile selection (DD-421)', () => {
  it('uses diver 2 pickup when diver 1 has needsPickup:false and diver 2 has needsPickup:true', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      // Diver 1: no pickup
      await ctx.db.insert('customerProfiles', {
        bookingId,
        linkToken: 'tok-1',
        needsPickup: false,
      })

      // Diver 2: has pickup
      await ctx.db.insert('customerProfiles', {
        bookingId,
        linkToken: 'tok-2',
        needsPickup: true,
        pickupTime: '07:00',
        pickupLocation: 'Patong Beach Hotel',
      })

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.pickupTime).toBe('07:00')
      expect(confirmed?.logistics?.pickupLocation).toBe('Patong Beach Hotel')
    })
  })

  it('single-diver booking with needsPickup:true retains pickup fields in notification', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      await ctx.db.insert('customerProfiles', {
        bookingId,
        linkToken: 'tok-1',
        needsPickup: true,
        pickupTime: '06:45',
        pickupLocation: 'Kata Rocks',
      })

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.pickupTime).toBe('06:45')
      expect(confirmed?.logistics?.pickupLocation).toBe('Kata Rocks')
    })
  })

  it('notification omits pickup fields when no diver has needsPickup:true', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      await ctx.db.insert('customerProfiles', {
        bookingId,
        linkToken: 'tok-1',
        needsPickup: false,
      })

      await ctx.db.insert('customerProfiles', {
        bookingId,
        linkToken: 'tok-2',
        needsPickup: false,
      })

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed).toBeDefined()
      expect(confirmed?.type).toBe(NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.pickupTime).toBeUndefined()
      expect(confirmed?.logistics?.pickupLocation).toBeUndefined()
    })
  })

  it('falls back to first profile with pickup data when no profile has needsPickup:true', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      // Profile with no needsPickup flag but has pickup data (legacy / no flag set)
      await ctx.db.insert('customerProfiles', {
        bookingId,
        linkToken: 'tok-fallback',
        pickupTime: '06:30',
        pickupLocation: 'Laguna Hotel',
      })
      // Second profile also with pickup data but no needsPickup flag
      await ctx.db.insert('customerProfiles', {
        bookingId,
        linkToken: 'tok-second',
        pickupTime: '09:00',
        pickupLocation: 'Airport',
      })

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      // First profile with pickup data wins
      expect(confirmed?.logistics?.pickupTime).toBe('06:30')
      expect(confirmed?.logistics?.pickupLocation).toBe('Laguna Hotel')
    })
  })
})

// ─── DD-425: collectLogistics error swallow path ──────────────────────────────

describe('tryAutoAdvance collectLogistics error swallow (DD-425)', () => {
  it('advances booking and sends notification without logistics when collectLogistics throws', async () => {
    await t.run(async (ctx) => {
      // Seed a booking that will advance (forms complete, no reservations = vacuously true)
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      // Intercept ctx.db.query so collectLogistics throws when it queries bookingSessions.
      // tryAutoAdvance's main path (no in-system EM, no reservations) does not query
      // bookingSessions, so only collectLogistics is affected.
      const originalQuery = ctx.db.query.bind(ctx.db)
      ctx.db.query = ((tableName: TableNames) => {
        if (tableName === 'bookingSessions') {
          throw new Error('Simulated transient DB error in collectLogistics')
        }
        return originalQuery(tableName)
      }) as typeof ctx.db.query

      await tryAutoAdvance(ctx, bookingId)

      // Restore original query for assertions
      ctx.db.query = originalQuery

      // Booking still advanced to Upcoming despite collectLogistics failure
      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Upcoming')

      // Notification was still sent (fire-and-forget pattern)
      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.userId).toBe(TEST_SLUGS.diveCenter)
      expect(confirmed?.bookingId).toEqual(bookingId)
      expect(confirmed?.message).toBe('Your booking is confirmed.')

      // Logistics is absent because collectLogistics threw
      expect(confirmed?.logistics).toBeUndefined()
    })
  })
})

// ─── DD-427: deliveryLocation → departureLocation mapping ────────────────────

describe('collectLogistics deliveryLocation mapping (DD-427)', () => {
  it('maps session.deliveryLocation to logistics.departureLocation', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: TEST_SLUGS.instructor,
        displayName: 'John Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: TEST_SLUGS.instructor,
        ownerType: 'Instructor',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
        deliveryLocation: 'BoatPier',
      })

      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.departureLocation).toBe('BoatPier')
    })
  })

  it('omits departureLocation from logistics when session has no deliveryLocation', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: TEST_SLUGS.instructor,
        displayName: 'John Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: TEST_SLUGS.instructor,
        ownerType: 'Instructor',
      })
      // No deliveryLocation field
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })

      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: 'Confirmed',
      })
      await ctx.db.insert('availabilitySnapshots', {
        inventoryUnitId: unitId,
        date: testDate(5),
        windowStart: '08:00',
        windowEnd: '16:00',
        totalUnits: 1,
        reservedUnits: 1,
        availableUnits: 0,
      })

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.departureLocation).toBeUndefined()
    })
  })
})

// ─── DD-426: hasMissingResource gate blocks auto-advance ─────────────────────

describe('tryAutoAdvance hasMissingResource gate (DD-426)', () => {
  it('does NOT advance to Upcoming when a reservation is vacated with StakeholderDeclined', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      // Seed an inventory unit and session
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: TEST_SLUGS.instructor,
        displayName: 'John Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: TEST_SLUGS.instructor,
        ownerType: 'Instructor',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })

      // Reservation vacated by stakeholder declining — booking is missing a required resource
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: RESERVATION_STATUS.Vacated,
        vacatedBy: VACATED_REASON.StakeholderDeclined,
        vacatedAt: Date.now(),
      })

      await tryAutoAdvance(ctx, bookingId)

      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Draft')

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed).toBeUndefined()
    })
  })

  it('does NOT advance to Upcoming when a reservation is vacated with DateBlocked', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: TEST_SLUGS.instructor,
        displayName: 'John Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: TEST_SLUGS.instructor,
        ownerType: 'Instructor',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })

      // Reservation vacated because the date was blocked — also a missing resource
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: RESERVATION_STATUS.Vacated,
        vacatedBy: VACATED_REASON.DateBlocked,
        vacatedAt: Date.now(),
      })

      await tryAutoAdvance(ctx, bookingId)

      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Draft')

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed).toBeUndefined()
    })
  })

  it('DOES advance to Upcoming when the only vacated reservation reason is BookingCancelled (not a missing resource)', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Instructor',
        resourceId: TEST_SLUGS.instructor,
        displayName: 'John Instructor',
        capacityModel: 'Exclusive',
        totalUnits: 1,
        ownerId: TEST_SLUGS.instructor,
        ownerType: 'Instructor',
      })
      const sessionId = await ctx.db.insert('bookingSessions', {
        bookingId,
        inventoryUnitId: unitId,
        date: testDate(5),
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Asia/Bangkok',
      })

      // Reservation vacated for BookingCancelled — does not set hasMissingResource
      // No active reservations remain → allConfirmed is vacuously true
      await ctx.db.insert('reservations', {
        bookingId,
        inventoryUnitId: unitId,
        bookingSessionId: sessionId,
        unitsRequested: 1,
        status: RESERVATION_STATUS.Vacated,
        vacatedBy: VACATED_REASON.BookingCancelled,
        vacatedAt: Date.now(),
      })

      await tryAutoAdvance(ctx, bookingId)

      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Upcoming')

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.userId).toBe(TEST_SLUGS.diveCenter)
      expect(confirmed?.bookingId).toEqual(bookingId)
    })
  })
})
