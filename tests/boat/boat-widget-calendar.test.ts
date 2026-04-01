import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT } from '../helpers/convex-helpers'
import {
  seedUser, seedBoatProfile, seedBooking, seedSession,
  seedInventoryUnit, TEST_SLUGS, TEST_TOKENS,
} from '../fixtures'
import { testDate } from '../helpers/dates'

const BOAT_TOKEN = 'test|boat-user'
const BOAT_SLUG = 'hug-ocean'

describe('boatWidget.getVesselCalendarData', () => {
  it('returns null when no boat profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: BOAT_TOKEN, slug: BOAT_SLUG, role: 'Boat' })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getVesselCalendarData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(14),
      })

    expect(result).toBeNull()
  })

  it('returns vessels with zero capacity when no sessions exist', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { tokenIdentifier: BOAT_TOKEN, slug: BOAT_SLUG, role: 'Boat' })
      await seedBoatProfile(ctx, userId, {
        fleet: [
          { boatName: 'MV Hug Ocean', maxPax: 50, boatType: 'day_boat' },
          { boatName: 'MV Reef', maxPax: 30, boatType: 'speedboat' },
        ],
      })
      await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        displayName: 'MV Hug Ocean',
        capacityModel: 'Pooled',
        totalUnits: 50,
        ownerId: BOAT_SLUG,
        ownerType: 'Boat',
      })
      await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        displayName: 'MV Reef',
        capacityModel: 'Pooled',
        totalUnits: 30,
        ownerId: BOAT_SLUG,
        ownerType: 'Boat',
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getVesselCalendarData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(2),
      })

    expect(result).not.toBeNull()
    expect(result!.vessels).toHaveLength(2)
    expect(result!.vessels[0].name).toBe('MV Hug Ocean')
    expect(result!.vessels[0].maxPax).toBe(50)
    expect(result!.vessels[1].name).toBe('MV Reef')
    expect(result!.vessels[1].maxPax).toBe(30)

    const day0 = testDate(0)
    expect(result!.vessels[0].dailyCapacity[day0]).toEqual({ booked: 0, total: 50 })
  })

  it('reflects booked pax from sessions linked to bookings', async () => {
    const t = makeT()
    const day = testDate(5)

    let unitId: string = ''
    await t.run(async (ctx) => {
      const boatUserId = await seedUser(ctx, { tokenIdentifier: BOAT_TOKEN, slug: BOAT_SLUG, role: 'Boat' })
      await seedBoatProfile(ctx, boatUserId, {
        fleet: [{ boatName: 'MV Hug Ocean', maxPax: 50, boatType: 'day_boat' }],
      })
      const uid = await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        displayName: 'MV Hug Ocean',
        capacityModel: 'Pooled',
        totalUnits: 50,
        ownerId: BOAT_SLUG,
        ownerType: 'Boat',
      })
      unitId = uid as unknown as string

      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.diveCenter,
        slug: TEST_SLUGS.diveCenter,
        role: 'DiveCenter',
      })

      const bookingId = await seedBooking(ctx, {
        startDate: day,
        endDate: day,
        divers: [
          { name: 'Alice', abbrev: 'AL', flag: { code: 'en', label: 'English' }, startDate: day, endDate: day, activityType: ['OW'] },
          { name: 'Bob', abbrev: 'BO', flag: { code: 'de', label: 'German' }, startDate: day, endDate: day, activityType: ['OW'] },
          { name: 'Carol', abbrev: 'CA', flag: { code: 'fr', label: 'French' }, startDate: day, endDate: day, activityType: ['OW'] },
        ],
      })

      await seedSession(ctx, bookingId, uid, { date: day })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getVesselCalendarData, {
        dateRangeStart: day,
        dateRangeEnd: day,
      })

    expect(result!.vessels).toHaveLength(1)
    expect(result!.vessels[0].dailyCapacity[day]).toEqual({ booked: 3, total: 50 })
  })

  it('handles fleet vessels without matching inventory units gracefully', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { tokenIdentifier: BOAT_TOKEN, slug: BOAT_SLUG, role: 'Boat' })
      await seedBoatProfile(ctx, userId, {
        fleet: [{ boatName: 'Ghost Ship', maxPax: 100, boatType: 'catamaran' }],
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getVesselCalendarData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(1),
      })

    expect(result!.vessels).toHaveLength(1)
    expect(result!.vessels[0].unitId).toBe('')
    expect(result!.vessels[0].dailyCapacity[testDate(0)]).toEqual({ booked: 0, total: 100 })
  })
})
