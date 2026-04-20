import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT, expectConvexError } from '../helpers/convex-helpers'
import { seedUser, seedInventoryUnit, seedEquipmentProfile, TEST_SLUGS, TEST_TOKENS } from '../fixtures'
import type { Id } from '../../convex/_generated/dataModel'
import { evaluateGearInventoryCompleteness } from '../../convex/lib/equipmentGearCompleteness'
import { checkProfileCompleteness } from '../../convex/lib/profileCompleteness'

const EM_TOKEN = 'test|em-user'
const EM_SLUG = TEST_SLUGS.em
const EM_IDENTITY = {
  tokenIdentifier: EM_TOKEN,
  orgId: `test_${EM_SLUG}`,
  orgRole: 'admin' as const,
  orgSlug: EM_SLUG,
}

async function seedEM(t: ReturnType<typeof makeT>) {
  await t.run(async (ctx) => {
    const userId = await seedUser(ctx, {
      tokenIdentifier: EM_TOKEN,
      slug: EM_SLUG,
      role: 'Equipment',
    })
    await seedEquipmentProfile(ctx, userId)
  })
}

describe('equipmentInventory', () => {
  describe('addItem', () => {
    it('creates inventoryUnits + equipmentInventory rows', async () => {
      const t = makeT()
      await seedEM(t)

      const inventoryId = await t
        .withIdentity(EM_IDENTITY)
        .mutation(api.equipmentInventory.addItem, {
          gearType: 'wetsuit',
          manufacturer: 'ScubaPro',
          size: 'M',
          totalUnits: 5,
        })

      expect(inventoryId).toBeTruthy()

      const grouped = await t
        .withIdentity(EM_IDENTITY)
        .query(api.equipmentInventory.listMyInventory, {})

      expect(grouped.wetsuit).toHaveLength(1)
      expect(grouped.wetsuit[0]).toMatchObject({
        gearType: 'wetsuit',
        manufacturer: 'ScubaPro',
        size: 'M',
        totalUnits: 5,
      })
    })

    it('rejects totalUnits < 1', async () => {
      const t = makeT()
      await seedEM(t)

      await expectConvexError(
        t.withIdentity(EM_IDENTITY)
          .mutation(api.equipmentInventory.addItem, {
            gearType: 'mask',
            totalUnits: 0,
          }),
        'VALIDATION',
      )
    })

    it('rejects unauthenticated users', async () => {
      const t = makeT()

      await expectConvexError(
        t.mutation(api.equipmentInventory.addItem, {
          gearType: 'mask',
          totalUnits: 5,
        }),
        'UNAUTHENTICATED',
      )
    })

    it('rejects non-Equipment role', async () => {
      const t = makeT()
      await t.run(async (ctx) => {
        await seedUser(ctx, {
          tokenIdentifier: TEST_TOKENS.diveCenter,
          slug: TEST_SLUGS.diveCenter,
          role: 'DiveCenter',
        })
      })

      await expectConvexError(
        t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
          .mutation(api.equipmentInventory.addItem, {
            gearType: 'mask',
            totalUnits: 5,
          }),
        'FORBIDDEN',
      )
    })
  })

  describe('updateItem', () => {
    it('patches totalUnits on both tables', async () => {
      const t = makeT()
      await seedEM(t)

      const inventoryId = await t
        .withIdentity(EM_IDENTITY)
        .mutation(api.equipmentInventory.addItem, {
          gearType: 'bcd',
          manufacturer: 'Mares',
          size: 'L',
          totalUnits: 3,
        })

      await t
        .withIdentity(EM_IDENTITY)
        .mutation(api.equipmentInventory.updateItem, {
          inventoryId,
          totalUnits: 10,
        })

      const grouped = await t
        .withIdentity(EM_IDENTITY)
        .query(api.equipmentInventory.listMyInventory, {})

      expect(grouped.bcd[0].totalUnits).toBe(10)
    })

    it('rejects reducing below reserved count', async () => {
      const t = makeT()
      await seedEM(t)

      const inventoryId = await t
        .withIdentity(EM_IDENTITY)
        .mutation(api.equipmentInventory.addItem, {
          gearType: 'regulator',
          totalUnits: 10,
        })

      // Retrieve the inventoryUnitId, then seed a snapshot with reservedUnits
      const grouped = await t
        .withIdentity(EM_IDENTITY)
        .query(api.equipmentInventory.listMyInventory, {})
      const unitId = grouped.regulator[0].inventoryUnitId

      await t.run(async (ctx) => {
        const { seedSnapshot } = await import('../fixtures/seedInventory')
        await seedSnapshot(ctx, unitId as Id<'inventoryUnits'>, {
          reservedUnits: 8,
          totalUnits: 10,
        })
      })

      await expectConvexError(
        t.withIdentity(EM_IDENTITY)
          .mutation(api.equipmentInventory.updateItem, {
            inventoryId,
            totalUnits: 5,
          }),
        'VALIDATION',
      )
    })
  })

  describe('removeItem', () => {
    it('deletes both equipmentInventory and inventoryUnits rows', async () => {
      const t = makeT()
      await seedEM(t)

      const inventoryId = await t
        .withIdentity(EM_IDENTITY)
        .mutation(api.equipmentInventory.addItem, {
          gearType: 'fins',
          size: 'EU 42',
          totalUnits: 5,
        })

      await t
        .withIdentity(EM_IDENTITY)
        .mutation(api.equipmentInventory.removeItem, { inventoryId })

      const grouped = await t
        .withIdentity(EM_IDENTITY)
        .query(api.equipmentInventory.listMyInventory, {})

      expect(grouped.fins ?? []).toHaveLength(0)
    })

    it('blocks removal when active reservations exist', async () => {
      const t = makeT()
      await seedEM(t)

      const inventoryId = await t
        .withIdentity(EM_IDENTITY)
        .mutation(api.equipmentInventory.addItem, {
          gearType: 'mask',
          totalUnits: 10,
        })

      // Seed an active reservation pointing to this unit
      const grouped = await t
        .withIdentity(EM_IDENTITY)
        .query(api.equipmentInventory.listMyInventory, {})
      const unitId = grouped.mask[0].inventoryUnitId

      await t.run(async (ctx) => {
        const { seedBooking, seedReservation, seedSession } = await import('../fixtures/seedBookings')
        const bookingId = await seedBooking(ctx)
        const sessionId = await seedSession(ctx, bookingId, unitId as Id<'inventoryUnits'>)
        await seedReservation(ctx, bookingId, unitId as Id<'inventoryUnits'>, sessionId, {
          status: 'Confirmed',
        })
      })

      await expectConvexError(
        t.withIdentity(EM_IDENTITY)
          .mutation(api.equipmentInventory.removeItem, { inventoryId }),
        'CONFLICT',
      )
    })
  })

  describe('listMyInventory', () => {
    it('returns items grouped by gearType', async () => {
      const t = makeT()
      await seedEM(t)

      const auth = t.withIdentity(EM_IDENTITY)
      await auth.mutation(api.equipmentInventory.addItem, { gearType: 'wetsuit', manufacturer: 'ScubaPro', size: 'S', totalUnits: 3 })
      await auth.mutation(api.equipmentInventory.addItem, { gearType: 'wetsuit', manufacturer: 'ScubaPro', size: 'M', totalUnits: 4 })
      await auth.mutation(api.equipmentInventory.addItem, { gearType: 'mask', totalUnits: 10 })

      const grouped = await auth.query(api.equipmentInventory.listMyInventory, {})

      expect(grouped.wetsuit).toHaveLength(2)
      expect(grouped.mask).toHaveLength(1)
      expect(grouped.fins ?? []).toHaveLength(0)
    })

    it('returns empty object when no items exist', async () => {
      const t = makeT()
      await seedEM(t)

      const grouped = await t
        .withIdentity(EM_IDENTITY)
        .query(api.equipmentInventory.listMyInventory, {})

      expect(Object.keys(grouped)).toHaveLength(0)
    })
  })

  describe('syncManufacturersByGearType side effect', () => {
    it('addItem with manufacturer populates equipment.manufacturersByGearType', async () => {
      const t = makeT()
      await seedEM(t)
      const auth = t.withIdentity(EM_IDENTITY)

      await auth.mutation(api.equipmentInventory.addItem, {
        gearType: 'wetsuit',
        manufacturer: 'ScubaPro',
        size: 'M',
        totalUnits: 5,
      })

      const profile = await auth.query(api.equipment.mine, {})
      expect(profile?.manufacturersByGearType?.wetsuit).toEqual(['ScubaPro'])
    })

    it('addItem without manufacturer leaves manufacturersByGearType empty for that gearType', async () => {
      const t = makeT()
      await seedEM(t)
      const auth = t.withIdentity(EM_IDENTITY)

      await auth.mutation(api.equipmentInventory.addItem, {
        gearType: 'mask',
        totalUnits: 10,
      })

      const profile = await auth.query(api.equipment.mine, {})
      expect(profile?.manufacturersByGearType?.mask ?? []).toEqual([])
    })

    it('updateItem manufacturer swap removes old and adds new', async () => {
      const t = makeT()
      await seedEM(t)
      const auth = t.withIdentity(EM_IDENTITY)

      const inventoryId = await auth.mutation(api.equipmentInventory.addItem, {
        gearType: 'bcd',
        manufacturer: 'Mares',
        size: 'L',
        totalUnits: 3,
      })

      const before = await auth.query(api.equipment.mine, {})
      expect(before?.manufacturersByGearType?.bcd).toEqual(['Mares'])

      await auth.mutation(api.equipmentInventory.updateItem, {
        inventoryId,
        manufacturer: 'ScubaPro',
      })

      const after = await auth.query(api.equipment.mine, {})
      expect(after?.manufacturersByGearType?.bcd).toEqual(['ScubaPro'])
    })

    it('removeItem clears gearType entry when last manufacturer item removed', async () => {
      const t = makeT()
      await seedEM(t)
      const auth = t.withIdentity(EM_IDENTITY)

      const inventoryId = await auth.mutation(api.equipmentInventory.addItem, {
        gearType: 'fins',
        manufacturer: 'Cressi',
        size: 'EU 42',
        totalUnits: 5,
      })

      const before = await auth.query(api.equipment.mine, {})
      expect(before?.manufacturersByGearType?.fins).toEqual(['Cressi'])

      await auth.mutation(api.equipmentInventory.removeItem, { inventoryId })

      const after = await auth.query(api.equipment.mine, {})
      expect(after?.manufacturersByGearType?.fins ?? []).toEqual([])
    })

    it('removeItem of one item keeps other manufacturers for same gearType', async () => {
      const t = makeT()
      await seedEM(t)
      const auth = t.withIdentity(EM_IDENTITY)

      await auth.mutation(api.equipmentInventory.addItem, {
        gearType: 'regulator',
        manufacturer: 'Atomic',
        totalUnits: 2,
      })
      const second = await auth.mutation(api.equipmentInventory.addItem, {
        gearType: 'regulator',
        manufacturer: 'Apeks',
        totalUnits: 3,
      })

      await auth.mutation(api.equipmentInventory.removeItem, { inventoryId: second })

      const after = await auth.query(api.equipment.mine, {})
      expect(after?.manufacturersByGearType?.regulator).toEqual(['Atomic'])
    })
  })

  describe('gearInventoryCompleteness', () => {
    it('reports all five gear types as incomplete when inventory is empty', async () => {
      const t = makeT()
      await seedEM(t)

      const incomplete = await t.run(async (ctx) =>
        evaluateGearInventoryCompleteness(ctx, EM_SLUG),
      )

      expect(incomplete.sort()).toEqual(['bcd', 'fins', 'mask', 'regulator', 'wetsuit'])
    })

    it('keeps wetsuit incomplete when the only row lacks a size', async () => {
      const t = makeT()
      await seedEM(t)
      const auth = t.withIdentity(EM_IDENTITY)

      await auth.mutation(api.equipmentInventory.addItem, {
        gearType: 'wetsuit',
        manufacturer: 'ScubaPro',
        totalUnits: 3,
      })

      const incomplete = await t.run(async (ctx) =>
        evaluateGearInventoryCompleteness(ctx, EM_SLUG),
      )
      expect(incomplete).toContain('wetsuit')
    })

    it('returns empty when each gear type has at least one complete row', async () => {
      const t = makeT()
      await seedEM(t)
      const auth = t.withIdentity(EM_IDENTITY)

      await auth.mutation(api.equipmentInventory.addItem, {
        gearType: 'wetsuit', manufacturer: 'ScubaPro', size: 'M', totalUnits: 5,
      })
      await auth.mutation(api.equipmentInventory.addItem, {
        gearType: 'bcd', manufacturer: 'ScubaPro', size: 'M', totalUnits: 4,
      })
      await auth.mutation(api.equipmentInventory.addItem, {
        gearType: 'fins', manufacturer: 'Cressi', size: 'EU 42', sizeSystem: 'eu', totalUnits: 6,
      })
      await auth.mutation(api.equipmentInventory.addItem, {
        gearType: 'mask', manufacturer: 'Aqua Lung', size: 'Standard', totalUnits: 8,
      })
      await auth.mutation(api.equipmentInventory.addItem, {
        gearType: 'regulator', manufacturer: 'Apeks', totalUnits: 3,
      })

      const incomplete = await t.run(async (ctx) =>
        evaluateGearInventoryCompleteness(ctx, EM_SLUG),
      )
      expect(incomplete).toEqual([])
    })

    it('drops Equipment profile completeness below 100% when inventory is empty', async () => {
      const t = makeT()
      const userId = await t.run(async (ctx) => {
        const id = await seedUser(ctx, {
          tokenIdentifier: EM_TOKEN,
          slug: EM_SLUG,
          role: 'Equipment',
        })
        await seedEquipmentProfile(ctx, id)
        return id
      })

      const status = await t.run(async (ctx) =>
        checkProfileCompleteness(ctx, { _id: userId }, 'Equipment'),
      )

      expect(status.incomplete).toContain('gearInventory')
      expect(status.percentage).toBeLessThan(100)
    })
  })
})
