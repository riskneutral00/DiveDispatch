import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT } from '../helpers/convex-helpers'
import {
  seedUser, seedEquipmentProfile, seedBooking, seedBookingResource,
  seedCustomerProfile, TEST_SLUGS, TEST_TOKENS,
} from '../fixtures'
import { testDate, passportExpiry, dob } from '../helpers/dates'
import type { Id } from '../../convex/_generated/dataModel'

const EM_TOKEN = 'test|em-user'
const EM_SLUG = TEST_SLUGS.em

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

describe('equipmentWidget.getDiverEquipmentData', () => {
  it('returns null when no EM profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment' })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .query(api.equipmentWidget.getDiverEquipmentData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(30),
      })

    expect(result).toBeNull()
  })

  it('returns empty bookings when no bookings reference this EM', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment' })
      await seedEquipmentProfile(ctx, userId)
    })

    const result = await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .query(api.equipmentWidget.getDiverEquipmentData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(30),
      })

    expect(result).not.toBeNull()
    expect(result!.bookings).toHaveLength(0)
  })

  it('returns bookings with diver data when EM is a resource', async () => {
    const t = makeT()
    const start = testDate(5)
    const end = testDate(7)

    await t.run(async (ctx) => {
      const emUserId = await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment' })
      await seedEquipmentProfile(ctx, emUserId)

      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.diveCenter,
        slug: TEST_SLUGS.diveCenter,
        role: 'DiveCenter',
      })

      const bookingId = await seedBooking(ctx, {
        startDate: start,
        endDate: end,
        divers: [
          { name: 'Alice', abbrev: 'AL', flag: { code: 'GB', label: 'UK' }, startDate: start, endDate: end, activityType: ['OW'] },
        ],
      })

      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceSlug: EM_SLUG,
      })

      const customerId = await ctx.db.insert('customers', customerFields({
        heightCm: 168,
        weightKg: 60,
        shoeSize: 39,
        shoeSizeUnit: 'EU',
      }))

      await seedCustomerProfile(ctx, bookingId, { customerId })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .query(api.equipmentWidget.getDiverEquipmentData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(30),
      })

    expect(result).not.toBeNull()
    expect(result!.bookings).toHaveLength(1)

    const booking = result!.bookings[0]
    expect(booking.divers).toHaveLength(1)
    expect(booking.divers[0].name).toBe('Alice')
    expect(booking.divers[0].heightCm).toBe(168)
    expect(booking.divers[0].weightKg).toBe(60)
    expect(booking.divers[0].shoeSize).toBe(39)
  })

  it('returns inventory items for the EM', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment' })
      await seedEquipmentProfile(ctx, userId)
    })

    // Add inventory via the mutation
    const auth = t.withIdentity({ tokenIdentifier: EM_TOKEN })
    await auth.mutation(api.equipmentInventory.addItem, {
      gearType: 'wetsuit',
      manufacturer: 'ScubaPro',
      size: 'M',
      totalUnits: 5,
    })
    await auth.mutation(api.equipmentInventory.addItem, {
      gearType: 'mask',
      totalUnits: 10,
    })

    const result = await auth.query(api.equipmentWidget.getDiverEquipmentData, {
      dateRangeStart: testDate(0),
      dateRangeEnd: testDate(30),
    })

    expect(result!.inventory).toHaveLength(2)
    const wetsuit = result!.inventory.find((i) => i.gearType === 'wetsuit')
    expect(wetsuit).toMatchObject({ manufacturer: 'ScubaPro', size: 'M', totalUnits: 5 })
  })

  it('filters bookings by date range', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const emUserId = await seedUser(ctx, { tokenIdentifier: EM_TOKEN, slug: EM_SLUG, role: 'Equipment' })
      await seedEquipmentProfile(ctx, emUserId)

      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.diveCenter,
        slug: TEST_SLUGS.diveCenter,
        role: 'DiveCenter',
      })

      // Booking in range
      const b1 = await seedBooking(ctx, { startDate: testDate(5), endDate: testDate(7) })
      await seedBookingResource(ctx, b1, { resourceType: 'Equipment', resourceSlug: EM_SLUG })

      // Booking outside range
      const b2 = await seedBooking(ctx, { startDate: testDate(60), endDate: testDate(62) })
      await seedBookingResource(ctx, b2, { resourceType: 'Equipment', resourceSlug: EM_SLUG })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .query(api.equipmentWidget.getDiverEquipmentData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(30),
      })

    expect(result!.bookings).toHaveLength(1)
  })
})
