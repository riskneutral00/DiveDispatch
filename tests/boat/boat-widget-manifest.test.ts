import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT } from '../helpers/convex-helpers'
import {
  seedUser, seedBoatProfile, seedBooking, seedSession,
  seedInventoryUnit, seedCustomerProfile,
  TEST_SLUGS, TEST_TOKENS,
} from '../fixtures'
import { testDate, passportExpiry, dob } from '../helpers/dates'
import type { Id } from '../../convex/_generated/dataModel'

const BOAT_TOKEN = 'test|boat-user'
const BOAT_SLUG = 'hug-ocean'

function customerFields(overrides: Record<string, unknown> = {}) {
  return {
    legalFirstName: 'Alice',
    legalLastName: 'Diver',
    email: 'alice@test.com',
    phone: '+66123456789',
    nationality: 'GB',
    dateOfBirth: dob(25),
    passportNumber: 'AB123456',
    passportIssuingCountry: 'GB',
    passportExpirationDate: passportExpiry(5),
    gender: 'F' as const,
    emergencyContactName: 'Bob',
    emergencyContactPhone: '+66987654321',
    emergencyContactRelation: 'Spouse',
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('boatWidget.getManifestData', () => {
  it('returns null when no boat profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: BOAT_TOKEN, slug: BOAT_SLUG, role: 'Boat' })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getManifestData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(14),
      })

    expect(result).toBeNull()
  })

  it('returns empty dates when no bookings exist', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { tokenIdentifier: BOAT_TOKEN, slug: BOAT_SLUG, role: 'Boat' })
      await seedBoatProfile(ctx, userId, {
        fleet: [{ boatName: 'MV Hug Ocean', maxPax: 50, boatType: 'day_boat' }],
      })
      await seedInventoryUnit(ctx, {
        resourceType: 'Boat',
        displayName: 'MV Hug Ocean',
        capacityModel: 'Pooled',
        totalUnits: 50,
        ownerId: BOAT_SLUG,
        ownerType: 'Boat',
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getManifestData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(2),
      })

    expect(result).not.toBeNull()
    expect(result!.vessels).toHaveLength(1)
    expect(result!.vessels[0].dates).toHaveLength(0)
  })

  it('returns manifest with diver details from customer profiles', async () => {
    const t = makeT()
    const day = testDate(5)

    await t.run(async (ctx) => {
      const boatUserId = await seedUser(ctx, { tokenIdentifier: BOAT_TOKEN, slug: BOAT_SLUG, role: 'Boat' })
      await seedBoatProfile(ctx, boatUserId, {
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

      const bookingId = await seedBooking(ctx, {
        startDate: day,
        endDate: day,
        operatorName: 'Blue Ocean Diving',
        activityType: ['OW'],
        divers: [
          { name: 'Alice', abbrev: 'AL', flag: { code: 'en', label: 'English' }, startDate: day, endDate: day, activityType: ['OW'] },
          { name: 'Bob', abbrev: 'BO', flag: { code: 'de', label: 'German' }, startDate: day, endDate: day, activityType: ['OW'] },
        ],
      })

      await seedSession(ctx, bookingId, unitId, { date: day })

      const customerId1 = await ctx.db.insert('customers', customerFields({
        legalFirstName: 'Alice',
        legalLastName: 'Smith',
        nationality: 'GB',
        passportNumber: 'GB111111',
        email: 'alice@test.com',
      }))
      const customerId2 = await ctx.db.insert('customers', customerFields({
        legalFirstName: 'Bob',
        legalLastName: 'Mueller',
        nationality: 'DE',
        passportNumber: 'DE222222',
        email: 'bob@test.com',
        gender: 'M' as const,
      }))

      await seedCustomerProfile(ctx, bookingId, { customerId: customerId1 })
      await seedCustomerProfile(ctx, bookingId, { customerId: customerId2 })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getManifestData, {
        dateRangeStart: day,
        dateRangeEnd: day,
      })

    expect(result).not.toBeNull()
    expect(result!.vessels).toHaveLength(1)

    const vessel = result!.vessels[0]
    expect(vessel.vesselName).toBe('MV Hug Ocean')
    expect(vessel.dates).toHaveLength(1)
    expect(vessel.dates[0].date).toBe(day)
    expect(vessel.dates[0].totalPax).toBe(2)

    const group = vessel.dates[0].groups[0]
    expect(group.operatorName).toBe('Blue Ocean Diving')
    expect(group.diverCount).toBe(2)
    expect(group.divers).toHaveLength(2)

    expect(group.divers[0].legalFirstName).toBe('Alice')
    expect(group.divers[0].legalLastName).toBe('Smith')
    expect(group.divers[0].nationality).toBe('GB')
    expect(group.divers[0].passportNumber).toBe('GB111111')

    expect(group.divers[1].legalFirstName).toBe('Bob')
    expect(group.divers[1].legalLastName).toBe('Mueller')
    expect(group.divers[1].nationality).toBe('DE')
  })

  it('groups multiple bookings under the same vessel and date', async () => {
    const t = makeT()
    const day = testDate(5)

    await t.run(async (ctx) => {
      const boatUserId = await seedUser(ctx, { tokenIdentifier: BOAT_TOKEN, slug: BOAT_SLUG, role: 'Boat' })
      await seedBoatProfile(ctx, boatUserId, {
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

      const booking1 = await seedBooking(ctx, {
        startDate: day, endDate: day,
        operatorName: 'DC Alpha',
        divers: [
          { name: 'Alice', abbrev: 'AL', flag: { code: 'en', label: 'English' }, startDate: day, endDate: day, activityType: ['OW'] },
        ],
      })
      const booking2 = await seedBooking(ctx, {
        startDate: day, endDate: day,
        operatorName: 'DC Beta',
        divers: [
          { name: 'Charlie', abbrev: 'CH', flag: { code: 'fr', label: 'French' }, startDate: day, endDate: day, activityType: ['AOW'] },
          { name: 'Diana', abbrev: 'DI', flag: { code: 'it', label: 'Italian' }, startDate: day, endDate: day, activityType: ['AOW'] },
        ],
      })

      await seedSession(ctx, booking1, unitId, { date: day })
      await seedSession(ctx, booking2, unitId, { date: day })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getManifestData, {
        dateRangeStart: day,
        dateRangeEnd: day,
      })

    const vessel = result!.vessels[0]
    expect(vessel.dates[0].groups).toHaveLength(2)
    expect(vessel.dates[0].totalPax).toBe(3)
    expect(vessel.dates[0].groups.map((g) => g.operatorName).sort()).toEqual(['DC Alpha', 'DC Beta'])
  })

  it('returns divers without customer data when profiles are incomplete', async () => {
    const t = makeT()
    const day = testDate(5)

    await t.run(async (ctx) => {
      const boatUserId = await seedUser(ctx, { tokenIdentifier: BOAT_TOKEN, slug: BOAT_SLUG, role: 'Boat' })
      await seedBoatProfile(ctx, boatUserId, {
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

      const bookingId = await seedBooking(ctx, {
        startDate: day, endDate: day,
        divers: [
          { name: 'Alice', abbrev: 'AL', flag: { code: 'en', label: 'English' }, startDate: day, endDate: day, activityType: ['OW'] },
        ],
      })

      await seedSession(ctx, bookingId, unitId, { date: day })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: BOAT_TOKEN })
      .query(api.boatWidget.getManifestData, {
        dateRangeStart: day,
        dateRangeEnd: day,
      })

    const diver = result!.vessels[0].dates[0].groups[0].divers[0]
    expect(diver.name).toBe('Alice')
    expect(diver.legalFirstName).toBeUndefined()
    expect(diver.passportNumber).toBeUndefined()
  })
})
