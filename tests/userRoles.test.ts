/**
 * userRoles — Junction Table Integration Tests
 *
 * Tests hasRole(), myRoles query, and addRole/removeRole mutations.
 * Foundation for multi-role support (SU Phase 1).
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUser, TEST_TOKENS, TEST_SLUGS, getOrCreateTestOrg } from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ─── hasRole (tested via internal helper, exposed through myRoles) ───────────

describe('userRoles.myRoles', () => {
  it('returns empty array for unauthenticated caller', async () => {
    const t = makeT()
    const roles = await t.query(api.userRoles.myRoles, {})
    expect(roles).toEqual([])
  })

  it('returns empty array when user has no userRoles rows', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { skipUserRoles: true })
    })

    const roles = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.myRoles, {})
    expect(roles).toEqual([])
  })

  it('returns all roles for a multi-role user', async () => {
    const t = makeT()
    let userId: any
    await t.run(async (ctx) => {
      userId = await seedUser(ctx, { skipUserRoles: true })
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      const t0 = Date.now()
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        createdAt: t0,
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        organizationId,
        createdAt: t0 + 1000,
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Equipment',
        organizationId,
        createdAt: t0 + 2000,
      })
    })

    const roles = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.myRoles, {})
    expect(roles).toHaveLength(3)
    expect(roles.map((r: any) => r.role)).toEqual(['DiveCenter', 'Boat', 'Equipment'])
  })

  it('returns only the requesting user\'s roles, not other users\'', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const dcUserId = await seedUser(ctx, { skipUserRoles: true })
      const dcOrgId = await getOrCreateTestOrg(ctx, dcUserId)
      const instrUserId = await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })
      const instrUser = await ctx.db.get(instrUserId)
      const now = Date.now()
      await ctx.db.insert('userRoles', {
        userId: dcUserId,
        role: 'DiveCenter',
        organizationId: dcOrgId,
        createdAt: now,
      })
      await ctx.db.insert('userRoles', {
        userId: instrUserId,
        role: 'Instructor',
        organizationId: instrUser!.organizationId!,
        createdAt: now,
      })
    })

    const roles = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.myRoles, {})
    expect(roles).toHaveLength(1)
    expect(roles[0].role).toBe('DiveCenter')
  })
})

// ─── hasRole query ──────────────────────────────────────────────────────────

describe('userRoles.hasRole', () => {
  it('returns true when user has the role', async () => {
    const t = makeT()
    let userId: any
    await t.run(async (ctx) => {
      userId = await seedUser(ctx, { skipUserRoles: true })
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        createdAt: Date.now(),
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.hasRole, { role: 'DiveCenter' })
    expect(result).toBe(true)
  })

  it('returns false when user does not have the role', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        createdAt: Date.now(),
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.hasRole, { role: 'Boat' })
    expect(result).toBe(false)
  })

  it('returns false for unauthenticated caller', async () => {
    const t = makeT()
    const result = await t.query(api.userRoles.hasRole, { role: 'DiveCenter' })
    expect(result).toBe(false)
  })
})

// ─── addRole ────────────────────────────────────────────────────────────────

describe('userRoles.addRole', () => {
  it('adds a new role to the user', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      await getOrCreateTestOrg(ctx, userId)
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.userRoles.addRole, { role: 'Boat' })

    const roles = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.myRoles, {})
    expect(roles).toHaveLength(1)
    expect(roles[0].role).toBe('Boat')
  })

  it('rejects duplicate role for the same user', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        createdAt: Date.now(),
      })
    })

    await expect(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
        .mutation(api.userRoles.addRole, { role: 'DiveCenter' }),
    ).rejects.toThrow(/DUPLICATE_ROLE/)
  })

  it('rejects unauthenticated caller', async () => {
    await expect(
      makeT().mutation(api.userRoles.addRole, { role: 'Boat' }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('inherits permissionLevel=member from caller\'s existing membership row', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        permissionLevel: 'member',
        createdAt: Date.now(),
      })
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.userRoles.addRole, { role: 'Boat' })

    const rows = await t.run(async (ctx) =>
      (await ctx.db.query('userRoles').collect()).filter((r) => r.role === 'Boat'),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.permissionLevel).toBe('member')
  })

  it('inherits permissionLevel=admin when existing membership is admin', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        permissionLevel: 'admin',
        createdAt: Date.now(),
      })
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.userRoles.addRole, { role: 'Boat' })

    const rows = await t.run(async (ctx) =>
      (await ctx.db.query('userRoles').collect()).filter((r) => r.role === 'Boat'),
    )
    expect(rows[0]?.permissionLevel).toBe('admin')
  })
})

// ─── hasAnyOperatorRole ─────────────────────────────────────────────────────

describe('userRoles.hasAnyOperatorRole', () => {
  it('returns true when user has an operator role', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        createdAt: Date.now(),
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.hasAnyOperatorRole, {})
    expect(result).toBe(true)
  })

  it('returns false when user has only resource roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        organizationId,
        createdAt: Date.now(),
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.hasAnyOperatorRole, {})
    expect(result).toBe(false)
  })
})

// ─── primaryRole ────────────────────────────────────────────────────────────

describe('userRoles.primaryRole', () => {
  it('returns the role marked as primary', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { skipUserRoles: true })
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      const now = Date.now()
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Boat',
        organizationId,
        createdAt: now,
      })
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId,
        createdAt: now,
      })
    })

    const primary = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.primaryRole, {})
    expect(primary).toBeTruthy()
    expect(primary!.role).toBe('DiveCenter')
    // primaryRole now derived via precedence, not isPrimary flag
  })

  it('returns null for unauthenticated caller', async () => {
    const t = makeT()
    const primary = await t.query(api.userRoles.primaryRole, {})
    expect(primary).toBeNull()
  })

  it('returns null when user has no roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { skipUserRoles: true })
    })

    const primary = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.userRoles.primaryRole, {})
    expect(primary).toBeNull()
  })
})

describe('userRoles.deleteRole — Venue multi-row cascade', () => {
  it('deleting the Venue role cascades inventory for every venue in the org', async () => {
    const t = makeT()
    let venueRoleId: any
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { role: 'Venue', tokenIdentifier: 'clerk|venuemulti', slug: 'venuemulti' })
      const orgId = await getOrCreateTestOrg(ctx, userId, 'venuemulti')
      await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        organizationId: orgId,
        createdAt: Date.now() + 1,
      })
      venueRoleId = (await ctx.db
        .query('userRoles')
        .withIndex('by_userId_role', (q) => q.eq('userId', userId).eq('role', 'Venue'))
        .unique())!._id

      for (const slug of ['v-one', 'v-two']) {
        await ctx.db.insert('venues', {
          organizationId: orgId,
          name: slug, slug,
          address: { city: 'Koh Tao', country: 'TH' },
          lat: 10, lng: 99, kind: "pool" as const, features: [] as ('reef' | 'wreck' | 'cave' | 'wall' | 'drift' | 'muck' | 'altitude' | 'lake' | 'river' | 'quarry' | 'night' | 'deep')[], verified: true,
        })
        await ctx.db.insert('inventoryUnits', {
          resourceType: 'Venue',
          resourceId: slug,
          displayName: slug,
          capacityModel: 'Pooled',
          totalUnits: 5,
          ownerId: slug,
          ownerType: 'Venue',
        })
      }
    })

    await t
      .withIdentity({ tokenIdentifier: 'clerk|venuemulti' })
      .mutation(api.userRoles.deleteRole, { roleId: venueRoleId })

    const { units, venues, role } = await t.run(async (ctx) => {
      const units = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_resourceType', (q) => q.eq('resourceType', 'Venue'))
        .collect()
      const venues = await ctx.db.query('venues').collect()
      const role = await ctx.db.get(venueRoleId)
      return { units, venues, role }
    })
    expect(units).toHaveLength(0)
    expect(venues).toHaveLength(0)
    expect(role).toBeNull()
  })
})
