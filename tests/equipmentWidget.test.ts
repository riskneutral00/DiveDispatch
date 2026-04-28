/**
 * DD-220: Test coverage for getDiverEquipmentData query.
 *
 * Tests the 6-table join: bookings -> customerProfiles -> customers,
 * equipmentBags, gearSizingLookup, equipmentInventory + inventoryUnits.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Id } from '../convex/_generated/dataModel'
import { api } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'
import { testDate } from './helpers/dates'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedBooking,
  seedCustomerProfile,
  seedBookingResource,
  seedEquipmentProfile,
  type SeedCtx, findProfileByUser } from './fixtures'

// ── Well-known EM test constants ─────────────────────────────────────────────

const EM_TOKEN = 'test|em-user'
const EM_SLUG = TEST_SLUGS.em

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Seed an equipment manager user + equipment profile. Returns userId. */
async function seedEM(
  ctx: SeedCtx,
  opts: {
    manufacturersByGearType?: Record<string, string[]>
  } = {},
) {
  const userId = await seedUser(ctx, {
    tokenIdentifier: EM_TOKEN,
    slug: EM_SLUG,
    role: 'Equipment',
    email: 'em@test.com',
  })
  await seedEquipmentProfile(ctx, userId, { name: 'Test Equipment' })
  // Patch manufacturersByGearType if provided (seedEquipmentProfile doesn't support it)
  if (opts.manufacturersByGearType) {
    const profile = await findProfileByUser(ctx, userId, 'equipment')
    if (profile) {
      await ctx.db.patch(profile._id, {
        manufacturersByGearType: opts.manufacturersByGearType,
      })
    }
  }
  return userId
}

/** Seed a customer record and return its ID. */
async function seedCustomer(
  ctx: SeedCtx,
  overrides: {
    heightCm?: number
    weightKg?: number
    shoeSize?: number
    shoeSizeUnit?: 'EU' | 'US' | 'CM'
    needsPoweredLenses?: boolean
    prescriptionStrength?: string
  } = {},
) {
  return ctx.db.insert('customers', {
    legalFirstName: 'Alice',
    legalLastName: 'Smith',
    email: 'alice@example.com',
    phone: '+66123456789',
    nationality: 'US',
    dateOfBirth: '1995-01-15',
    passportNumber: 'AB123456',
    passportIssuingCountry: 'US',
    passportExpirationDate: testDate(365 * 5),
    gender: 'F' as const,
    emergencyContactName: 'Jane Smith',
    emergencyContactPhone: '+66987654321',
    emergencyContactRelation: 'Spouse',
    createdAt: Date.now(),
    ...(overrides.heightCm !== undefined ? { heightCm: overrides.heightCm } : {}),
    ...(overrides.weightKg !== undefined ? { weightKg: overrides.weightKg } : {}),
    ...(overrides.shoeSize !== undefined ? { shoeSize: overrides.shoeSize } : {}),
    ...(overrides.shoeSizeUnit !== undefined ? { shoeSizeUnit: overrides.shoeSizeUnit } : {}),
    ...(overrides.needsPoweredLenses !== undefined
      ? { needsPoweredLenses: overrides.needsPoweredLenses }
      : {}),
    ...(overrides.prescriptionStrength !== undefined
      ? { prescriptionStrength: overrides.prescriptionStrength }
      : {}),
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getDiverEquipmentData', () => {
  let t: ReturnType<typeof makeT>

  beforeEach(() => {
    t = makeT()
  })

  it('returns null when user has no equipment profile', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: EM_TOKEN,
        slug: EM_SLUG,
        role: 'Equipment',
        email: 'em@test.com',
      })
      // No equipment profile seeded
    })

    const result = await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .query(api.equipmentWidget.getDiverEquipmentData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(14),
      })

    expect(result).toBeNull()
  })

  it('happy path: EM with 1 booking, 2 divers, bags assigned — all fields populated', async () => {
    await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .run(async (ctx) => {
        await seedEM(ctx)

        // Create customers with measurements
        const customerId1 = await seedCustomer(ctx, {
          heightCm: 175,
          weightKg: 70,
          shoeSize: 42,
          shoeSizeUnit: 'EU',
          needsPoweredLenses: true,
          prescriptionStrength: '-2.5',
        })
        const customerId2 = await seedCustomer(ctx, {
          heightCm: 160,
          weightKg: 55,
          shoeSize: 38,
          shoeSizeUnit: 'EU',
        })

        const startDate = testDate(5)
        const endDate = testDate(7)

        // Create booking first so we have a real ID for profiles
        const bookingId = await seedBooking(ctx, {
          ownerId: TEST_SLUGS.diveCenter,
          startDate,
          endDate,
          divers: [
            { name: 'Alice', abbrev: 'AL', flag: { code: 'en', label: 'English' }, startDate, endDate, activityType: ['OW'] },
            { name: 'Bob', abbrev: 'BO', flag: { code: 'de', label: 'German' }, startDate, endDate, activityType: ['OW'] },
          ],
        })

        // Create customer profiles with rental checklists
        const rentalChecklist = {
          mask: 'rent' as const,
          bcd: 'own' as const,
          wetsuit: 'rent' as const,
          fins: 'rent' as const,
          regulator: 'own' as const,
        }

        const profileId1 = await seedCustomerProfile(ctx, bookingId, {
          customerId: customerId1,
          rentalChecklist,
        })
        const profileId2 = await seedCustomerProfile(ctx, bookingId, {
          customerId: customerId2,
        })

        // Link booking to EM via bookingResources
        await seedBookingResource(ctx, bookingId, {
          resourceType: 'Equipment',
          resourceId: EM_SLUG,
        })

        // Assign bags (sorted by bagNumber, positional mapping to divers)
        await ctx.db.insert('equipmentBags', {
          bagNumber: 'BAG-001',
          equipmentManagerId: EM_SLUG,
          bookingId,
          status: 'Assigned',
          assignedAt: Date.now(),
        })
        await ctx.db.insert('equipmentBags', {
          bagNumber: 'BAG-002',
          equipmentManagerId: EM_SLUG,
          bookingId,
          status: 'Assigned',
          assignedAt: Date.now(),
        })
      })

    const result = await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .query(api.equipmentWidget.getDiverEquipmentData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(14),
      })

    expect(result).not.toBeNull()
    expect(result!.emSlug).toBe(EM_SLUG)
    expect(result!.emName).toBe('Test Equipment')
    expect(result!.bookings).toHaveLength(1)

    const booking = result!.bookings[0]
    expect(booking.diverCount).toBe(2)
    expect(booking.divers).toHaveLength(2)

    // Diver 0: Alice with measurements and rental checklist
    const alice = booking.divers[0]
    expect(alice.name).toBe('Alice')
    expect(alice.heightCm).toBe(175)
    expect(alice.weightKg).toBe(70)
    expect(alice.shoeSize).toBe(42)
    expect(alice.shoeSizeUnit).toBe('EU')
    expect(alice.needsPoweredLenses).toBe(true)
    expect(alice.prescriptionStrength).toBe('-2.5')
    expect(alice.rentalChecklist).toEqual({
      mask: 'rent',
      bcd: 'own',
      wetsuit: 'rent',
      fins: 'rent',
      regulator: 'own',
    })
    expect(alice.bag).toBeDefined()
    expect(alice.bag!.bagNumber).toBe('BAG-001')
    expect(alice.bag!.status).toBe('Assigned')

    // Diver 1: Bob with measurements, no rental checklist
    const bob = booking.divers[1]
    expect(bob.name).toBe('Bob')
    expect(bob.heightCm).toBe(160)
    expect(bob.weightKg).toBe(55)
    expect(bob.bag).toBeDefined()
    expect(bob.bag!.bagNumber).toBe('BAG-002')
  })

  it('date range filtering: booking outside range excluded', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedEM(ctx)

      // Booking in range (days 5-7)
      const inRangeId = await seedBooking(ctx, {
        startDate: testDate(5),
        endDate: testDate(7),
        divers: [{ name: 'Alice', abbrev: 'AL', flag: { code: 'en', label: 'English' }, startDate: testDate(5), endDate: testDate(7), activityType: ['OW'] }],
      })
      await seedBookingResource(ctx, inRangeId, {
        resourceType: 'Equipment',
        resourceId: EM_SLUG,
      })

      // Booking out of range (days 30-35)
      const outRangeId = await seedBooking(ctx, {
        startDate: testDate(30),
        endDate: testDate(35),
        divers: [{ name: 'Bob', abbrev: 'BO', flag: { code: 'de', label: 'German' }, startDate: testDate(30), endDate: testDate(35), activityType: ['OW'] }],
      })
      await seedBookingResource(ctx, outRangeId, {
        resourceType: 'Equipment',
        resourceId: EM_SLUG,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .query(api.equipmentWidget.getDiverEquipmentData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(14),
      })

    expect(result).not.toBeNull()
    expect(result!.bookings).toHaveLength(1)
    expect(result!.bookings[0].divers[0].name).toBe('Alice')
  })

  it('missing customer profile: diver row has undefined measurements', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedEM(ctx)

      const startDate = testDate(5)
      const endDate = testDate(7)

      // Booking with 1 diver, no customer profiles
      const bookingId = await seedBooking(ctx, {
        startDate,
        endDate,
        divers: [{ name: 'NoProfile', abbrev: 'NP', flag: { code: 'en', label: 'English' }, startDate, endDate, activityType: ['OW'] }],
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: EM_SLUG,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .query(api.equipmentWidget.getDiverEquipmentData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(14),
      })

    expect(result).not.toBeNull()
    const diver = result!.bookings[0].divers[0]
    expect(diver.name).toBe('NoProfile')
    expect(diver.heightCm).toBeUndefined()
    expect(diver.weightKg).toBeUndefined()
    expect(diver.shoeSize).toBeUndefined()
    expect(diver.rentalChecklist).toBeUndefined()
  })

  it('no bags assigned: diver row has bag undefined', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedEM(ctx)

      const startDate = testDate(5)
      const endDate = testDate(7)

      const bookingId = await seedBooking(ctx, {
        startDate,
        endDate,
        divers: [{ name: 'NoBag', abbrev: 'NB', flag: { code: 'en', label: 'English' }, startDate, endDate, activityType: ['OW'] }],
      })
      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: EM_SLUG,
      })
      // No bags inserted for this booking
    })

    const result = await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .query(api.equipmentWidget.getDiverEquipmentData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(14),
      })

    expect(result).not.toBeNull()
    const diver = result!.bookings[0].divers[0]
    expect(diver.bag).toBeUndefined()
  })

  it('rental checklist populated: asserts rentalChecklist fields correct', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedEM(ctx)

      const customerId = await seedCustomer(ctx)
      const startDate = testDate(5)
      const endDate = testDate(7)

      const bookingId = await seedBooking(ctx, {
        startDate,
        endDate,
        divers: [{ name: 'Renter', abbrev: 'RN', flag: { code: 'en', label: 'English' }, startDate, endDate, activityType: ['OW'] }],
      })

      const profileId = await seedCustomerProfile(ctx, bookingId, {
        customerId,
        rentalChecklist: {
          mask: 'rent',
          bcd: 'rent',
          wetsuit: 'own',
          fins: 'rent',
          regulator: 'own',
          maskPrescription: '-3.0',
        },
      })


      await seedBookingResource(ctx, bookingId, {
        resourceType: 'Equipment',
        resourceId: EM_SLUG,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .query(api.equipmentWidget.getDiverEquipmentData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(14),
      })

    expect(result).not.toBeNull()
    const diver = result!.bookings[0].divers[0]
    expect(diver.rentalChecklist).toEqual({
      mask: 'rent',
      bcd: 'rent',
      wetsuit: 'own',
      fins: 'rent',
      regulator: 'own',
      maskPrescription: '-3.0',
    })
  })

  it('gear sizing: only preferred manufacturers returned', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedEM(ctx, {
        manufacturersByGearType: {
          bcd: ['Scubapro'],
          wetsuit: ['Scubapro', 'Aqualung'],
        },
      })

      // Seed gear sizing entries - preferred manufacturers
      await ctx.db.insert('gearSizingLookup', {
        manufacturer: 'Scubapro',
        gearType: 'bcd',
        size: 'M',
        minHeight: 165,
        maxHeight: 180,
        minWeight: 60,
        maxWeight: 80,
      })
      await ctx.db.insert('gearSizingLookup', {
        manufacturer: 'Aqualung',
        gearType: 'wetsuit',
        size: 'L',
        minHeight: 170,
        maxHeight: 185,
        minWeight: 65,
        maxWeight: 85,
      })

      // Non-preferred manufacturer - should be excluded
      await ctx.db.insert('gearSizingLookup', {
        manufacturer: 'Mares',
        gearType: 'bcd',
        size: 'S',
        minHeight: 155,
        maxHeight: 170,
        minWeight: 50,
        maxWeight: 65,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .query(api.equipmentWidget.getDiverEquipmentData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(14),
      })

    expect(result).not.toBeNull()
    expect(result!.gearSizingEntries).toHaveLength(2)
    const manufacturers = result!.gearSizingEntries.map((e) => e.manufacturer)
    expect(manufacturers).toContain('Scubapro')
    expect(manufacturers).toContain('Aqualung')
    expect(manufacturers).not.toContain('Mares')
  })

  it('inventory: totalUnits from linked inventoryUnit', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedEM(ctx)

      // Create inventory unit with totalUnits = 5
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Equipment',
        resourceId: EM_SLUG,
        displayName: 'BCD Stock',
        capacityModel: 'Pooled',
        totalUnits: 5,
        ownerId: EM_SLUG,
        ownerType: 'Equipment',
      })

      // Create equipment inventory record linked to this unit
      await ctx.db.insert('equipmentInventory', {
        inventoryUnitId: unitId,
        equipmentManagerId: EM_SLUG,
        gearType: 'bcd',
        manufacturer: 'Scubapro',
        size: 'M',
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .query(api.equipmentWidget.getDiverEquipmentData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(14),
      })

    expect(result).not.toBeNull()
    expect(result!.inventory).toHaveLength(1)
    expect(result!.inventory[0].gearType).toBe('bcd')
    expect(result!.inventory[0].manufacturer).toBe('Scubapro')
    expect(result!.inventory[0].size).toBe('M')
    expect(result!.inventory[0].totalUnits).toBe(5)
  })

  it('inventory: totalUnits is 0 when inventoryUnit is missing', async () => {
    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      await seedEM(ctx)

      // Create a temporary unit, get its ID, then delete it
      const unitId = await ctx.db.insert('inventoryUnits', {
        resourceType: 'Equipment',
        resourceId: EM_SLUG,
        displayName: 'Deleted Stock',
        capacityModel: 'Pooled',
        totalUnits: 10,
        ownerId: EM_SLUG,
        ownerType: 'Equipment',
      })

      await ctx.db.insert('equipmentInventory', {
        inventoryUnitId: unitId,
        equipmentManagerId: EM_SLUG,
        gearType: 'fins',
      })

      // Delete the inventory unit to simulate orphaned reference
      await ctx.db.delete(unitId)
    })

    const result = await t
      .withIdentity({ tokenIdentifier: EM_TOKEN })
      .query(api.equipmentWidget.getDiverEquipmentData, {
        dateRangeStart: testDate(0),
        dateRangeEnd: testDate(14),
      })

    expect(result).not.toBeNull()
    expect(result!.inventory).toHaveLength(1)
    expect(result!.inventory[0].totalUnits).toBe(0)
  })
})
