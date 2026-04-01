import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT, expectConvexError } from '../helpers/convex-helpers'
import { seedUser, seedInventoryUnit, seedEquipmentProfile, TEST_SLUGS, TEST_TOKENS } from '../fixtures'
import type { Id } from '../../convex/_generated/dataModel'

const EM_TOKEN = 'test|em-user'
const EM_SLUG = TEST_SLUGS.em

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
        .withIdentity({ tokenIdentifier: EM_TOKEN })
        .mutation(api.equipmentInventory.addItem, {
          gearType: 'wetsuit',
          manufacturer: 'ScubaPro',
          size: 'M',
          totalUnits: 5,
        })

      expect(inventoryId).toBeTruthy()

      const grouped = await t
        .withIdentity({ tokenIdentifier: EM_TOKEN })
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
        t.withIdentity({ tokenIdentifier: EM_TOKEN })
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
        .withIdentity({ tokenIdentifier: EM_TOKEN })
        .mutation(api.equipmentInventory.addItem, {
          gearType: 'bcd',
          manufacturer: 'Mares',
          size: 'L',
          totalUnits: 3,
        })

      await t
        .withIdentity({ tokenIdentifier: EM_TOKEN })
        .mutation(api.equipmentInventory.updateItem, {
          inventoryId,
          totalUnits: 10,
        })

      const grouped = await t
        .withIdentity({ tokenIdentifier: EM_TOKEN })
        .query(api.equipmentInventory.listMyInventory, {})

      expect(grouped.bcd[0].totalUnits).toBe(10)
    })

    it('rejects reducing below reserved count', async () => {
      const t = makeT()
      await seedEM(t)

      const inventoryId = await t
        .withIdentity({ tokenIdentifier: EM_TOKEN })
        .mutation(api.equipmentInventory.addItem, {
          gearType: 'regulator',
          totalUnits: 10,
        })

      // Retrieve the inventoryUnitId, then seed a snapshot with reservedUnits
      const grouped = await t
        .withIdentity({ tokenIdentifier: EM_TOKEN })
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
        t.withIdentity({ tokenIdentifier: EM_TOKEN })
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
        .withIdentity({ tokenIdentifier: EM_TOKEN })
        .mutation(api.equipmentInventory.addItem, {
          gearType: 'fins',
          size: 'EU 42',
          totalUnits: 5,
        })

      await t
        .withIdentity({ tokenIdentifier: EM_TOKEN })
        .mutation(api.equipmentInventory.removeItem, { inventoryId })

      const grouped = await t
        .withIdentity({ tokenIdentifier: EM_TOKEN })
        .query(api.equipmentInventory.listMyInventory, {})

      expect(grouped.fins ?? []).toHaveLength(0)
    })

    it('blocks removal when active reservations exist', async () => {
      const t = makeT()
      await seedEM(t)

      const inventoryId = await t
        .withIdentity({ tokenIdentifier: EM_TOKEN })
        .mutation(api.equipmentInventory.addItem, {
          gearType: 'mask',
          totalUnits: 10,
        })

      // Seed an active reservation pointing to this unit
      const grouped = await t
        .withIdentity({ tokenIdentifier: EM_TOKEN })
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
        t.withIdentity({ tokenIdentifier: EM_TOKEN })
          .mutation(api.equipmentInventory.removeItem, { inventoryId }),
        'CONFLICT',
      )
    })
  })

  describe('listMyInventory', () => {
    it('returns items grouped by gearType', async () => {
      const t = makeT()
      await seedEM(t)

      const auth = t.withIdentity({ tokenIdentifier: EM_TOKEN })
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
        .withIdentity({ tokenIdentifier: EM_TOKEN })
        .query(api.equipmentInventory.listMyInventory, {})

      expect(Object.keys(grouped)).toHaveLength(0)
    })
  })
})
