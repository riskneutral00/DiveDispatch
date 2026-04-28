import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUserWithOrg as seedUser } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

const VALID_EQUIPMENT_ARGS = {
  name: 'Rene Equipment Co',
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.09,
  lng: 99.84,
  email: 'equip@test.com',
  phone: '+66123456789',
}

describe('equipment.visibleToMe — destination-scoped discovery', () => {
  it('returns own-org + destination-org equipment for an operator with destinationIds', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      const areaId = await ctx.db.insert('organizations', {
        slug: 'south-andaman',
        name: 'South Andaman',
        isAreaOrg: true,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('equipment', {
        organizationId: areaId,
        slug: 'eq-area',
        name: 'Area Equipment',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8,
        lng: 98.3,
        email: 'area-e@test.com',
        phone: '+66110000000',
        verified: true,
      })
      const operatorId = await seedUser(ctx, 'rene-eq-vis', 'Equipment')
      const user = await ctx.db.get(operatorId)
      if (!user?.organizationId) throw new Error('op org missing')
      await ctx.db.patch(user.organizationId, { destinationIds: [areaId] })
      await ctx.db.insert('equipment', {
        organizationId: user.organizationId,
        slug: 'eq-rene',
        name: 'Rene Equipment',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8,
        lng: 98.3,
        email: 'rene-e@test.com',
        phone: '+66120000000',
        verified: true,
      })
    })

    const results = await t.withIdentity(orgIdentityFor('rene-eq-vis')).query(api.equipment.visibleToMe, {})
    expect(results.map((e) => e.name).sort()).toEqual(['Area Equipment', 'Rene Equipment'])
  })

  it('returns own-org equipment only when destinationIds is undefined', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'solo-eq-vis', 'Equipment')
      const user = await ctx.db.get(userId)
      if (!user?.organizationId) throw new Error('op org missing')
      await ctx.db.insert('equipment', {
        organizationId: user.organizationId,
        slug: 'eq-solo',
        name: 'Solo Equipment',
        address: { city: 'Koh Tao', country: 'TH' },
        lat: 10,
        lng: 99,
        email: 'solo-e@test.com',
        phone: '+66130000000',
        verified: true,
      })
    })

    const results = await t.withIdentity(orgIdentityFor('solo-eq-vis')).query(api.equipment.visibleToMe, {})
    expect(results.map((e) => e.name)).toEqual(['Solo Equipment'])
  })

  it('returns empty array for unauthenticated caller', async () => {
    const t = makeT()
    expect(await t.query(api.equipment.visibleToMe, {})).toEqual([])
  })
})

describe('equipment.archive', () => {
  async function readEquipmentRoleComplete(t: ReturnType<typeof makeT>, slug: string): Promise<boolean | undefined> {
    return await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique()
      if (!user) return undefined
      const row = await ctx.db
        .query('userRoles')
        .withIndex('by_userId_role', (q) => q.eq('userId', user._id).eq('role', 'Equipment'))
        .unique()
      return row?.profileComplete
    })
  }

  it('sets archivedAt on the row', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'archive-eq-owner', 'Equipment') })
    const identity = orgIdentityFor('archive-eq-owner')

    const eqId = await t.withIdentity(identity).mutation(api.equipment.create, VALID_EQUIPMENT_ARGS)
    await t.withIdentity(identity).mutation(api.equipment.archive, { entityId: eqId })

    await t.run(async (ctx) => {
      const row = await ctx.db.get(eqId as Id<'equipment'>) as Doc<'equipment'> | null
      expect(row?.archivedAt).toBeTypeOf('number')
    })
  })

  it('archiving the last active equipment row re-evaluates userRoles.profileComplete', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'archive-last-eq', 'Equipment') })
    const identity = orgIdentityFor('archive-last-eq')

    const eqId = await t.withIdentity(identity).mutation(api.equipment.create, VALID_EQUIPMENT_ARGS)

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', 'archive-last-eq'))
        .unique()
      const role = await ctx.db
        .query('userRoles')
        .withIndex('by_userId_role', (q) => q.eq('userId', user!._id).eq('role', 'Equipment'))
        .unique()
      await ctx.db.patch(role!._id, { profileComplete: true })
      await ctx.db.patch(eqId as Id<'equipment'>, { profileComplete: true })
    })

    expect(await readEquipmentRoleComplete(t, 'archive-last-eq')).toBe(true)

    await t.withIdentity(identity).mutation(api.equipment.archive, { entityId: eqId })
    expect(await readEquipmentRoleComplete(t, 'archive-last-eq')).not.toBe(true)
  })

  it('throws NOT_FOUND for unknown entityId', async () => {
    const t = makeT()
    await t.run(async (ctx) => { await seedUser(ctx, 'archive-eq-not-found', 'Equipment') })
    const identity = orgIdentityFor('archive-eq-not-found')

    const realId = await t.withIdentity(identity).mutation(api.equipment.create, VALID_EQUIPMENT_ARGS)
    await t.run(async (ctx) => { await ctx.db.delete(realId as Id<'equipment'>) })

    await expect(
      t.withIdentity(identity).mutation(api.equipment.archive, { entityId: realId }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('throws FORBIDDEN when archiving equipment owned by a different org', async () => {
    const t = makeT()
    let strangerEqId: Id<'equipment'> | null = null
    await t.run(async (ctx) => {
      const ownerId = await seedUser(ctx, 'cross-org-eq-owner', 'Equipment')
      const ownerUser = await ctx.db.get(ownerId)
      strangerEqId = await ctx.db.insert('equipment', {
        organizationId: ownerUser!.organizationId!,
        slug: 'foreign-equipment',
        name: 'Foreign Equipment',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.9,
        lng: 98.4,
        email: 'foreign-eq@test.com',
        phone: '+66999999999',
        verified: false,
      })
      await seedUser(ctx, 'attacker-eq', 'Equipment')
    })

    await expect(
      t.withIdentity(orgIdentityFor('attacker-eq')).mutation(api.equipment.archive, {
        entityId: strangerEqId!,
      }),
    ).rejects.toThrow(/FORBIDDEN/)
  })
})
