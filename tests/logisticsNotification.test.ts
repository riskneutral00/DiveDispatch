import { describe, it, expect, beforeEach } from 'vitest'
import { notify } from '../convex/notifications'
import { tryAutoAdvance } from '../convex/bookings/_shared'
import { NOTIFICATION_TYPE, RESERVATION_STATUS, VACATED_REASON } from '../convex/shared/statuses'
import type { Id, TableNames } from '../convex/_generated/dataModel'
import { testDate } from './helpers/dates'
import {
  TEST_SLUGS,
  seedUser,
  seedNotification,
  seedBooking,
  seedInventoryUnit,
  seedSession,
  seedReservation,
  seedSnapshot,
  seedCustomerProfile,
  seedBookingResource,
} from './fixtures'
import { makeT } from './helpers/convex-helpers'
import { HOLD_TTL_MS } from '../convex/lib/auth'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

async function seedConfirmedBooking(
  ctx: Parameters<Parameters<typeof t.run>[0]>[0],
  ownerId: string,
  ownerType: 'DiveCenter' | 'Agent' = 'DiveCenter',
): Promise<Id<'bookings'>> {
  return seedBooking(ctx, {
    ownerId,
    ownerType,
    bookingFormComplete: true,
    customerFormComplete: true,
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
  })
}

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

      const unitId = await seedInventoryUnit(ctx, {
        ownerId: TEST_SLUGS.instructor,
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'John Instructor',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)

      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed' })
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, availableUnits: 0 })

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.departureTime).toBe('08:00')
    })
  })

  it('populates pickupTime and pickupLocation from customerProfile when present', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      await seedCustomerProfile(ctx, bookingId, {
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

      await seedBookingResource(ctx, bookingId, {
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

      await seedInventoryUnit(ctx, {
        ownerId: boatSlug,
        ownerType: 'Boat',
        resourceType: 'Boat',
        displayName: 'MV Sea Rider',
      })

      await seedBookingResource(ctx, bookingId, {
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

  it('does not emit confirmed notification when booking stays Draft (conditions unmet)', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: TEST_SLUGS.diveCenter,
        bookingFormComplete: false,
        customerFormComplete: false,
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

describe('collectLogistics pickup profile selection (DD-421)', () => {
  it('uses diver 2 pickup when diver 1 has needsPickup:false and diver 2 has needsPickup:true', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      await seedCustomerProfile(ctx, bookingId, {
        needsPickup: false,
      })

      await seedCustomerProfile(ctx, bookingId, {
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

      await seedCustomerProfile(ctx, bookingId, {
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

      await seedCustomerProfile(ctx, bookingId, { needsPickup: false })
      await seedCustomerProfile(ctx, bookingId, { needsPickup: false })

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

      await seedCustomerProfile(ctx, bookingId, {
        pickupTime: '06:30',
        pickupLocation: 'Laguna Hotel',
      })
      await seedCustomerProfile(ctx, bookingId, {
        pickupTime: '09:00',
        pickupLocation: 'Airport',
      })

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.pickupTime).toBe('06:30')
      expect(confirmed?.logistics?.pickupLocation).toBe('Laguna Hotel')
    })
  })
})

describe('tryAutoAdvance collectLogistics error swallow (DD-425)', () => {
  it('advances booking and sends notification without logistics when collectLogistics throws', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      const originalQuery = ctx.db.query.bind(ctx.db)
      ctx.db.query = ((tableName: TableNames) => {
        if (tableName === 'bookingSessions') {
          throw new Error('Simulated transient DB error in collectLogistics')
        }
        return originalQuery(tableName)
      }) as typeof ctx.db.query

      await tryAutoAdvance(ctx, bookingId)

      ctx.db.query = originalQuery

      const booking = await ctx.db.get(bookingId)
      expect(booking?.status).toBe('Upcoming')

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.userId).toBe(TEST_SLUGS.diveCenter)
      expect(confirmed?.bookingId).toEqual(bookingId)
      expect(confirmed?.message).toBe('Your booking is confirmed.')

      expect(confirmed?.logistics).toBeUndefined()
    })
  })
})

describe('collectLogistics deliveryLocation mapping (DD-427)', () => {
  it('maps session.deliveryLocation to logistics.departureLocation', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      const unitId = await seedInventoryUnit(ctx, {
        ownerId: TEST_SLUGS.instructor,
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'John Instructor',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId, {
        deliveryLocation: 'BoatPier',
      })

      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed' })
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, availableUnits: 0 })

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.departureLocation).toBe('BoatPier')
    })
  })

  it('omits departureLocation from logistics when session has no deliveryLocation', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      const unitId = await seedInventoryUnit(ctx, {
        ownerId: TEST_SLUGS.instructor,
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'John Instructor',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)

      await seedReservation(ctx, bookingId, unitId, sessionId, { status: 'Confirmed' })
      await seedSnapshot(ctx, unitId, { reservedUnits: 1, availableUnits: 0 })

      await tryAutoAdvance(ctx, bookingId)

      const notifications = await ctx.db.query('notifications').collect()
      const confirmed = notifications.find((n) => n.type === NOTIFICATION_TYPE.BookingConfirmed)
      expect(confirmed?.logistics?.departureLocation).toBeUndefined()
    })
  })
})

describe('tryAutoAdvance hasMissingResource gate (DD-426)', () => {
  it('does NOT advance to Upcoming when a reservation is vacated with StakeholderDeclined', async () => {
    await t.run(async (ctx) => {
      const bookingId = await seedConfirmedBooking(ctx, TEST_SLUGS.diveCenter)

      const unitId = await seedInventoryUnit(ctx, {
        ownerId: TEST_SLUGS.instructor,
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'John Instructor',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)

      await seedReservation(ctx, bookingId, unitId, sessionId, {
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

      const unitId = await seedInventoryUnit(ctx, {
        ownerId: TEST_SLUGS.instructor,
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'John Instructor',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)

      await seedReservation(ctx, bookingId, unitId, sessionId, {
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

      const unitId = await seedInventoryUnit(ctx, {
        ownerId: TEST_SLUGS.instructor,
        ownerType: 'Instructor',
        resourceType: 'Instructor',
        displayName: 'John Instructor',
      })
      const sessionId = await seedSession(ctx, bookingId, unitId)

      await seedReservation(ctx, bookingId, unitId, sessionId, {
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
