import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'
import {
  seedUser,
  seedBoatProfile,
  seedBooking,
  seedSession,
  seedInventoryUnit,
  seedVenue,
  getOrCreateTestOrg,
  findProfileByUser,
  TEST_SLUGS,
  TEST_TOKENS,
} from './fixtures'
import { testDate } from './helpers/dates'

const BOAT_TOKEN = 'test|boat-trips-user'
const BOAT_SLUG = 'trips-hug-ocean'

function dayOfWeek(isoDate: string): number {
  return new Date(isoDate + 'T00:00:00').getDay()
}

describe('boatWidget.getVesselCalendarTrips', () => {
  it('returns [] when the user has no boat profile', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: BOAT_TOKEN,
        slug: BOAT_SLUG,
        role: 'DiveCenter',
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getVesselCalendarTrips, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(2),
      })

    expect(result).toEqual([])
  })

  it('reports booked diver counts across multiple dates for one vessel', async () => {
    const t = makeT()
    const startDate = testDate(5)
    const midDate = testDate(6)
    const endDate = testDate(7)

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        tokenIdentifier: BOAT_TOKEN,
        slug: BOAT_SLUG,
        role: 'Boat',
      })
      await seedBoatProfile(ctx, userId, {
        fleet: [{ boatName: 'MV Hug Ocean', maxPax: 50, boatType: 'day_boat' }],
      })
      const unitId = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        displayName: 'MV Hug Ocean',
        capacityModel: 'Pooled',
        totalUnits: 50,
        ownerId: BOAT_SLUG,
        ownerType: 'Boat',
      })

      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.diveCenter,
        slug: TEST_SLUGS.diveCenter,
        role: 'DiveCenter',
      })

      const bookingA = await seedBooking(ctx, {
        startDate,
        endDate: midDate,
        divers: [
          { name: 'Alice', abbrev: 'AL', flag: { code: 'en', label: 'English' }, startDate, endDate: midDate, activityType: ['OW'] },
          { name: 'Bob', abbrev: 'BO', flag: { code: 'de', label: 'German' }, startDate, endDate: midDate, activityType: ['OW'] },
        ],
      })
      await seedSession(ctx, bookingA, unitId, { date: startDate })
      await seedSession(ctx, bookingA, unitId, { date: midDate })

      const bookingB = await seedBooking(ctx, {
        startDate: endDate,
        endDate,
        divers: [
          { name: 'Carol', abbrev: 'CA', flag: { code: 'fr', label: 'French' }, startDate: endDate, endDate, activityType: ['OW'] },
        ],
      })
      await seedSession(ctx, bookingB, unitId, { date: endDate })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getVesselCalendarTrips, {
        dateRangeStart: startDate,
        dateRangeEnd: endDate,
      })

    expect(result).toHaveLength(3)
    const byDate = new Map(result.map((trip) => [trip.startDate, trip]))
    expect(byDate.get(startDate)?.diverCount).toBe(2)
    expect(byDate.get(midDate)?.diverCount).toBe(2)
    expect(byDate.get(endDate)?.diverCount).toBe(1)
    for (const trip of result) {
      expect(trip.boatName).toBe('MV Hug Ocean')
      expect(trip.isReferral).toBe(false)
      expect(trip.resources).toEqual([])
    }
  })

  it('resolves route names from venueIds including multi-venue routes', async () => {
    const t = makeT()
    const date = testDate(3)
    const dow = dayOfWeek(date)

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        tokenIdentifier: BOAT_TOKEN,
        slug: BOAT_SLUG,
        role: 'Boat',
      })
      const organizationId = await getOrCreateTestOrg(ctx, userId, 'Trips Boat Org')
      const shark = await seedVenue(ctx, {
        organizationId,
        name: 'Shark Island',
        kind: 'dive_site',
      })
      const chumphon = await seedVenue(ctx, {
        organizationId,
        name: 'Chumphon Pinnacle',
        kind: 'dive_site',
      })

      await seedBoatProfile(ctx, userId, {
        organizationId,
        fleet: [
          {
            boatName: 'MV Hug Ocean',
            maxPax: 50,
            boatType: 'day_boat',
          },
        ],
      })
      const boatDoc = await findProfileByUser(ctx, userId, 'boats')
      if (!boatDoc) throw new Error('boat profile missing after seed')
      await ctx.db.patch(boatDoc._id, {
        fleet: [
          {
            boatName: 'MV Hug Ocean',
            maxPax: 50,
            boatType: 'day_boat',
            routes: [{ venueIds: [shark, chumphon], daysOfWeek: [dow] }],
          },
        ],
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getVesselCalendarTrips, {
        dateRangeStart: date,
        dateRangeEnd: date,
      })

    expect(result).toHaveLength(1)
    expect(result[0].operatorName).toBe('Shark Island / Chumphon Pinnacle')
    expect(result[0].activityType).toEqual(['Shark Island / Chumphon Pinnacle'])
  })

  it('returns only the caller-org fleet when two boat orgs both have profiles', async () => {
    const t = makeT()
    const date = testDate(8)

    const OTHER_TOKEN = 'test|other-boat-user'
    const OTHER_SLUG = 'other-boat-slug'

    await t.run(async (ctx) => {
      const ownerUserId = await seedUser(ctx, {
        tokenIdentifier: BOAT_TOKEN,
        slug: BOAT_SLUG,
        role: 'Boat',
      })
      await seedBoatProfile(ctx, ownerUserId, {
        fleet: [{ boatName: 'MV Hug Ocean', maxPax: 50, boatType: 'day_boat' }],
      })
      const ownerUnit = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        displayName: 'MV Hug Ocean',
        capacityModel: 'Pooled',
        totalUnits: 50,
        ownerId: BOAT_SLUG,
        ownerType: 'Boat',
      })
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.diveCenter,
        slug: TEST_SLUGS.diveCenter,
        role: 'DiveCenter',
      })
      const ownerBooking = await seedBooking(ctx, {
        startDate: date,
        endDate: date,
        divers: [
          { name: 'D1', abbrev: 'D1', flag: { code: 'en', label: 'English' }, startDate: date, endDate: date, activityType: ['OW'] },
          { name: 'D2', abbrev: 'D2', flag: { code: 'en', label: 'English' }, startDate: date, endDate: date, activityType: ['OW'] },
          { name: 'D3', abbrev: 'D3', flag: { code: 'en', label: 'English' }, startDate: date, endDate: date, activityType: ['OW'] },
        ],
      })
      await seedSession(ctx, ownerBooking, ownerUnit, { date })

      const otherUserId = await seedUser(ctx, {
        tokenIdentifier: OTHER_TOKEN,
        slug: OTHER_SLUG,
        role: 'Boat',
      })
      await seedBoatProfile(ctx, otherUserId, {
        fleet: [{ boatName: 'MV Other Boat', maxPax: 20, boatType: 'day_boat' }],
      })
      const otherUnit = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        displayName: 'MV Other Boat',
        capacityModel: 'Pooled',
        totalUnits: 20,
        ownerId: OTHER_SLUG,
        ownerType: 'Boat',
      })
      const otherBooking = await seedBooking(ctx, {
        startDate: date,
        endDate: date,
        ownerId: OTHER_SLUG,
        divers: [
          { name: 'X1', abbrev: 'X1', flag: { code: 'en', label: 'English' }, startDate: date, endDate: date, activityType: ['OW'] },
        ],
      })
      await seedSession(ctx, otherBooking, otherUnit, { date })
    })

    const ownerResult = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getVesselCalendarTrips, {
        dateRangeStart: date,
        dateRangeEnd: date,
      })
    expect(ownerResult).toHaveLength(1)
    expect(ownerResult[0].boatName).toBe('MV Hug Ocean')
    expect(ownerResult[0].diverCount).toBe(3)

    const otherResult = await t
      .withIdentity({ tokenIdentifier: OTHER_TOKEN })
      .query(api.boatWidget.getVesselCalendarTrips, {
        dateRangeStart: date,
        dateRangeEnd: date,
      })
    expect(otherResult).toHaveLength(1)
    expect(otherResult[0].boatName).toBe('MV Other Boat')
    expect(otherResult[0].diverCount).toBe(1)
  })

  it('preserves vessel input order across multiple vessels with distinct routes', async () => {
    const t = makeT()
    const date = testDate(4)
    const dow = dayOfWeek(date)

    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        tokenIdentifier: BOAT_TOKEN,
        slug: BOAT_SLUG,
        role: 'Boat',
      })
      const organizationId = await getOrCreateTestOrg(ctx, userId, 'Multi Vessel Org')
      const siteA = await seedVenue(ctx, {
        organizationId,
        name: 'Site Alpha',
        kind: 'dive_site',
      })
      const siteB = await seedVenue(ctx, {
        organizationId,
        name: 'Site Bravo',
        kind: 'dive_site',
      })

      await seedBoatProfile(ctx, userId, {
        organizationId,
        fleet: [
          { boatName: 'MV Alpha', maxPax: 20, boatType: 'speedboat' },
          { boatName: 'MV Bravo', maxPax: 30, boatType: 'day_boat' },
        ],
      })
      const boatDoc = await findProfileByUser(ctx, userId, 'boats')
      if (!boatDoc) throw new Error('boat profile missing after seed')
      await ctx.db.patch(boatDoc._id, {
        fleet: [
          {
            boatName: 'MV Alpha',
            maxPax: 20,
            boatType: 'speedboat',
            routes: [{ venueIds: [siteA], daysOfWeek: [dow] }],
          },
          {
            boatName: 'MV Bravo',
            maxPax: 30,
            boatType: 'day_boat',
            routes: [{ venueIds: [siteB], daysOfWeek: [dow] }],
          },
        ],
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getVesselCalendarTrips, {
        dateRangeStart: date,
        dateRangeEnd: date,
      })

    expect(result).toHaveLength(2)
    expect(result[0].boatName).toBe('MV Alpha')
    expect(result[0].operatorName).toBe('Site Alpha')
    expect(result[1].boatName).toBe('MV Bravo')
    expect(result[1].operatorName).toBe('Site Bravo')
  })
})
