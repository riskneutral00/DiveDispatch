import { describe, it, expect } from 'vitest'
import { makeT, orgIdentityFor } from '../helpers/convex-helpers'
import { seedUserWithOrg } from '../fixtures'
import { setRoleProfileComplete } from '../../convex/lib/setRoleProfileComplete'

describe('setRoleProfileComplete — per-row + AND-aggregate for entity roles', () => {
  it('all 3 compressors complete -> every row.profileComplete=true + userRoles.profileComplete=true', async () => {
    const t = makeT()
    const userId = await t.run(async (ctx) => {
      const id = await seedUserWithOrg(ctx, 'sea-fun-perrow-1', 'Compressor')
      const user = await ctx.db.get(id)
      if (!user?.organizationId) throw new Error('no org')
      for (const slug of ['c1', 'c2', 'c3']) {
        await ctx.db.insert('compressors', {
          organizationId: user.organizationId,
          slug,
          name: `${slug} Compressor`,
          address: { city: 'Phuket', country: 'TH' },
          lat: 7.8,
          lng: 98.3,
          email: `${slug}@t.com`,
          phone: '+66110000000',
          gasMixes: ['air'],
          verified: true,
        })
      }
      return id
    })

    await t.run(async (ctx) => {
      await setRoleProfileComplete(ctx, userId, 'Compressor')
    })

    const result = await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      const rows = await ctx.db
        .query('compressors')
        .withIndex('by_organizationId', (q) => q.eq('organizationId', user!.organizationId!))
        .collect()
      const userRolesRow = await ctx.db
        .query('userRoles')
        .withIndex('by_userId_role', (q) => q.eq('userId', userId).eq('role', 'Compressor'))
        .unique()
      return {
        rows: rows.map((r) => ({ slug: r.slug, complete: r.profileComplete })),
        roleComplete: userRolesRow?.profileComplete,
      }
    })

    expect(result.rows.map((r) => r.complete)).toEqual([true, true, true])
    expect(result.roleComplete).toBe(true)
  })

  it('one compressor missing gasMixes -> that row false, role-level AND=false, others true', async () => {
    const t = makeT()
    const userId = await t.run(async (ctx) => {
      const id = await seedUserWithOrg(ctx, 'sea-fun-perrow-2', 'Compressor')
      const user = await ctx.db.get(id)
      if (!user?.organizationId) throw new Error('no org')
      const inserts: Array<{ slug: string; gasMixes: Array<'air' | 'nitrox'> }> = [
        { slug: 'c1', gasMixes: ['air'] },
        { slug: 'c2', gasMixes: [] },
        { slug: 'c3', gasMixes: ['air'] },
      ]
      for (const seed of inserts) {
        await ctx.db.insert('compressors', {
          organizationId: user.organizationId,
          slug: seed.slug,
          name: `${seed.slug} Compressor`,
          address: { city: 'Phuket', country: 'TH' },
          lat: 7.8,
          lng: 98.3,
          email: `${seed.slug}@t.com`,
          phone: '+66110000000',
          gasMixes: seed.gasMixes,
          verified: true,
        })
      }
      return id
    })

    await t.run(async (ctx) => {
      await setRoleProfileComplete(ctx, userId, 'Compressor')
    })

    const result = await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      const rows = await ctx.db
        .query('compressors')
        .withIndex('by_organizationId', (q) => q.eq('organizationId', user!.organizationId!))
        .collect()
      const userRolesRow = await ctx.db
        .query('userRoles')
        .withIndex('by_userId_role', (q) => q.eq('userId', userId).eq('role', 'Compressor'))
        .unique()
      const bySlug = new Map(rows.map((r) => [r.slug, r.profileComplete]))
      return {
        c1: bySlug.get('c1'),
        c2: bySlug.get('c2'),
        c3: bySlug.get('c3'),
        roleComplete: userRolesRow?.profileComplete,
      }
    })

    expect(result.c1).toBe(true)
    expect(result.c2).toBe(false)
    expect(result.c3).toBe(true)
    expect(result.roleComplete).toBe(false)
  })

  it('directory.listByRole gates on userRoles.profileComplete after per-row aggregate', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUserWithOrg(ctx, 'caller-perrow', 'DiveCenter')

      const opId = await seedUserWithOrg(ctx, 'op-perrow', 'Compressor')
      const user = await ctx.db.get(opId)
      if (!user?.organizationId) throw new Error('no org')
      await ctx.db.insert('compressors', {
        organizationId: user.organizationId,
        slug: 'op-c1',
        name: 'op-c1 Compressor',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.8,
        lng: 98.3,
        email: 'opc1@t.com',
        phone: '+66110000000',
        gasMixes: [],
        verified: true,
      })
      await setRoleProfileComplete(ctx, opId, 'Compressor')
    })

    const { api } = await import('../../convex/_generated/api')
    const result = await t
      .withIdentity(orgIdentityFor('caller-perrow'))
      .query(api.directory.listByRole, { role: 'Compressor' })

    expect(result).toHaveLength(0)
  })
})
