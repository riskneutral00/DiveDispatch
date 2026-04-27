import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { makeT, orgIdentityFor } from '../helpers/convex-helpers'
import { seedUserWithOrg, type SeedCtx } from '../fixtures'

async function markRoleComplete(
  ctx: SeedCtx,
  userId: Id<'users'>,
  role: 'Compressor' | 'Venue',
): Promise<void> {
  const row = await ctx.db
    .query('userRoles')
    .withIndex('by_userId_role', (q) => q.eq('userId', userId).eq('role', role))
    .unique()
  if (row) await ctx.db.patch(row._id, { profileComplete: true })
}

describe('directory.listByRole — survives multi-row entity roles', () => {
  it('does not throw when a Compressor user owns 3 compressor rows', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      // Caller — any authed user
      await seedUserWithOrg(ctx, 'caller-multirow', 'DiveCenter')

      // Mimic sea-fun: one user, Compressor role, 3 compressor rows under one org
      const opId = await seedUserWithOrg(ctx, 'sea-fun-test', 'Compressor')
      const op = await ctx.db.get(opId)
      if (!op?.organizationId) throw new Error('seed failed: no org for op')
      await markRoleComplete(ctx, opId, 'Compressor')

      const baseAddr = { city: 'Phuket', country: 'TH' }
      for (const slug of ['comp-1', 'comp-2', 'comp-3']) {
        await ctx.db.insert('compressors', {
          organizationId: op.organizationId,
          slug,
          name: `${slug} Compressor`,
          address: baseAddr,
          lat: 7.8,
          lng: 98.3,
          email: `${slug}@test.com`,
          phone: '+66110000000',
          verified: true,
        })
      }
    })

    // Pre-Phase-1 this query throws "unique() returned more than one result"
    const result = await t
      .withIdentity(orgIdentityFor('caller-multirow'))
      .query(api.directory.listByRole, { role: 'Compressor' })

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(3)
    expect(result.map((r) => r.slug).sort()).toEqual(['comp-1', 'comp-2', 'comp-3'])
  })

  it('does not throw when a Venue user owns 2 venue rows', async () => {
    const t = makeT()

    await t.run(async (ctx) => {
      await seedUserWithOrg(ctx, 'caller-multirow-v', 'DiveCenter')

      const opId = await seedUserWithOrg(ctx, 'sea-fun-venue', 'Venue')
      const op = await ctx.db.get(opId)
      if (!op?.organizationId) throw new Error('seed failed: no org for op')
      await markRoleComplete(ctx, opId, 'Venue')

      for (const slug of ['venue-1', 'venue-2']) {
        await ctx.db.insert('venues', {
          organizationId: op.organizationId,
          slug,
          name: `${slug} Site`,
          kind: 'dive_site',
          features: ['reef'],
          address: { city: 'Phuket', country: 'TH' },
          lat: 7.8,
          lng: 98.3,
          verified: true,
        })
      }
    })

    const result = await t
      .withIdentity(orgIdentityFor('caller-multirow-v'))
      .query(api.directory.listByRole, { role: 'Venue' })

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result.map((r) => r.slug).sort()).toEqual(['venue-1', 'venue-2'])
  })
})
