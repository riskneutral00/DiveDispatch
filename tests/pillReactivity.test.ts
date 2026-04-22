import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'
import { TEST_SLUGS, seedUser, seedEquipmentProfile } from './fixtures'

const EM_TOKEN = 'test|em-pill-user'
const EM_SLUG = TEST_SLUGS.em

describe('pill reactivity — Equipment role gearInventory transition', () => {
  it('fails: pill stays stale after completing last missing gear type', async () => {
    const t = makeT()

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).run(async (ctx) => {
      const userId = await seedUser(ctx, {
        tokenIdentifier: EM_TOKEN,
        slug: EM_SLUG,
        role: 'Equipment',
        email: 'em-pill@test.com',
      })
      await seedEquipmentProfile(ctx, userId)

      const fourOfFive: Array<{ gearType: 'wetsuit' | 'bcd' | 'fins' | 'mask'; size?: string; sizeSystem?: 'letter' }> = [
        { gearType: 'wetsuit', size: 'M' },
        { gearType: 'bcd', size: 'M' },
        { gearType: 'fins', size: 'M', sizeSystem: 'letter' },
        { gearType: 'mask' },
      ]
      for (const g of fourOfFive) {
        const unitId = await ctx.db.insert('inventoryUnits', {
          resourceType: 'Equipment',
          resourceId: EM_SLUG,
          displayName: `${g.gearType} ScubaPro`,
          capacityModel: 'Pooled',
          totalUnits: 5,
          ownerId: EM_SLUG,
          ownerType: 'Equipment',
        })
        await ctx.db.insert('equipmentInventory', {
          inventoryUnitId: unitId,
          equipmentManagerId: EM_SLUG,
          gearType: g.gearType,
          manufacturer: 'ScubaPro',
          ...(g.size !== undefined ? { size: g.size } : {}),
          ...(g.sizeSystem !== undefined ? { sizeSystem: g.sizeSystem } : {}),
        })
      }
    })

    const before = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.users.getProfileCompletionForRole,
      { role: 'Equipment' },
    )
    expect(before.percentage).toBeLessThan(100)
    expect(before.incomplete).toContain('gearInventory')

    await t.withIdentity({ tokenIdentifier: EM_TOKEN }).mutation(
      api.equipmentInventory.addItem,
      { gearType: 'regulator', manufacturer: 'ScubaPro', totalUnits: 3 },
    )

    const after = await t.withIdentity({ tokenIdentifier: EM_TOKEN }).query(
      api.users.getProfileCompletionForRole,
      { role: 'Equipment' },
    )

    expect({
      before_incomplete: before.incomplete,
      after_incomplete: after.incomplete,
      before_percentage: before.percentage,
      after_percentage: after.percentage,
    }).toMatchObject({
      after_percentage: 100,
    })
    expect(after.incomplete).not.toContain('gearInventory')
    expect(after.percentage).toBe(100)
  })
})
