import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { assertDestinationOrgsValid, visibleOrgIds } from '../convex/lib/destinationScope'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import { TEST_USER_REQUIRED } from './helpers/userDefaults'

describe('destinationScope — assertDestinationOrgsValid', () => {
  it('accepts an area-org id', async () => {
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
      await expect(assertDestinationOrgsValid(ctx, [areaId])).resolves.toBeUndefined()
    })
  })

  it('throws VALIDATION when given an operator-org id', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      const operatorId = await ctx.db.insert('organizations', {
        slug: 'sea-fun-divers',
        name: 'Sea Fun Divers',
        createdAt: now,
        updatedAt: now,
      })
      await expect(assertDestinationOrgsValid(ctx, [operatorId])).rejects.toSatisfy((err: unknown) => {
        const e = err as { data: unknown }
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        return (data as Record<string, unknown>)?.code === 'VALIDATION'
          && (data as Record<string, unknown>)?.reason === 'not_an_area_org'
      })
    })
  })

  it('throws NOT_FOUND for non-existent id', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      const areaId = await ctx.db.insert('organizations', {
        slug: 'area',
        name: 'Area',
        isAreaOrg: true,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.delete(areaId)
      await expect(assertDestinationOrgsValid(ctx, [areaId])).rejects.toSatisfy((err: unknown) => {
        const e = err as { data: unknown }
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        return (data as Record<string, unknown>)?.code === 'NOT_FOUND'
      })
    })
  })
})

describe('destinationScope — visibleOrgIds', () => {
  it('returns empty when no identity', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const ids = await visibleOrgIds(ctx)
      expect(ids).toEqual([])
    })
  })

  it('returns [myOrg._id] when operator has no destinationIds', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|lone-operator'
    const orgId = await t.run(async (ctx) => {
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'lone',
        email: 'lone@test.com',
        firstName: 'Lone',
        lastName: 'Op',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
      })
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        slug: 'lone',
        name: 'Lone Org',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.patch(uid, { organizationId: oid })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: oid,
        createdAt: now,
      })
      return oid
    })

    const asUser = t.withIdentity({ tokenIdentifier })
    const result = await asUser.run(async (ctx) => visibleOrgIds(ctx))
    expect(result).toEqual([orgId])
  })

  it('returns [...destinationIds, myOrg._id] when operator has destinations', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|multi-dest'
    const { operatorId, areaId } = await t.run(async (ctx) => {
      const now = Date.now()
      const aid = await ctx.db.insert('organizations', {
        slug: 'south-andaman',
        name: 'South Andaman',
        isAreaOrg: true,
        createdAt: now,
        updatedAt: now,
      })
      const oid = await ctx.db.insert('organizations', {
        slug: 'sea-fun-divers',
        name: 'Sea Fun Divers',
        destinationIds: [aid],
        createdAt: now,
        updatedAt: now,
      })
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'rene',
        email: 'rene@test.com',
        firstName: 'Rene',
        lastName: 'B',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
      })
      await ctx.db.patch(uid, { organizationId: oid })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: oid,
        createdAt: now,
      })
      return { operatorId: oid, areaId: aid }
    })

    const asUser = t.withIdentity({ tokenIdentifier })
    const result = await asUser.run(async (ctx) => visibleOrgIds(ctx))
    expect(result).toEqual([areaId, operatorId])
  })
})

describe('organizations.updateBusinessMetadata — destinationIds wire-up', () => {
  it('rejects destinationIds that point at a non-area org', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|rene'
    const otherOperatorId = await t.run(async (ctx) => {
      const now = Date.now()
      const oid = await ctx.db.insert('organizations', {
        slug: 'sea-fun-divers',
        name: 'Sea Fun Divers',
        createdAt: now,
        updatedAt: now,
      })
      const otherId = await ctx.db.insert('organizations', {
        slug: 'hug-ocean',
        name: 'Hug Ocean',
        createdAt: now,
        updatedAt: now,
      })
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'rene',
        email: 'rene@test.com',
        firstName: 'Rene',
        lastName: 'B',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
      })
      await ctx.db.patch(uid, { organizationId: oid })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: oid,
        createdAt: now,
      })
      return otherId
    })

    await expectConvexError(
      t.withIdentity({ tokenIdentifier }).mutation(api.organizations.updateBusinessMetadata, {
        destinationIds: [otherOperatorId],
      }),
      'VALIDATION',
      'not_an_area_org',
    )
  })

  it('accepts destinationIds that point at an area org', async () => {
    const t = makeT()
    const tokenIdentifier = 'clerk|rene'
    const { operatorId, areaId } = await t.run(async (ctx) => {
      const now = Date.now()
      const aid = await ctx.db.insert('organizations', {
        slug: 'south-andaman',
        name: 'South Andaman',
        isAreaOrg: true,
        createdAt: now,
        updatedAt: now,
      })
      const oid = await ctx.db.insert('organizations', {
        slug: 'sea-fun-divers',
        name: 'Sea Fun Divers',
        createdAt: now,
        updatedAt: now,
      })
      const uid = await ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'rene',
        email: 'rene@test.com',
        firstName: 'Rene',
        lastName: 'B',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
      })
      await ctx.db.patch(uid, { organizationId: oid })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: oid,
        createdAt: now,
      })
      return { operatorId: oid, areaId: aid }
    })

    await t.withIdentity({ tokenIdentifier }).mutation(api.organizations.updateBusinessMetadata, {
      destinationIds: [areaId],
    })

    const updated = await t.run(async (ctx) => ctx.db.get(operatorId))
    expect(updated?.destinationIds).toEqual([areaId])
  })
})

describe('organizations.publicBySlug — public-safe org lookup', () => {
  it('returns only public fields for a known slug (no auth)', async () => {
    const t = makeT()
    const orgId = await t.run(async (ctx) => {
      const now = Date.now()
      return ctx.db.insert('organizations', {
        clerkOrgId: 'org_public_123',
        name: 'Public Test',
        slug: 'public-test',
        isAreaOrg: true,
        phone: '+66123456789',
        email: 'private@test.com',
        destinationIds: [],
        createdAt: now,
        updatedAt: now,
      })
    })

    const result = await t.query(api.organizations.publicBySlug, { slug: 'public-test' })
    expect(result).not.toBeNull()
    expect(result).toEqual({
      _id: orgId,
      name: 'Public Test',
      slug: 'public-test',
      isAreaOrg: true,
    })
    expect(Object.keys(result as Record<string, unknown>).sort()).toEqual(
      ['_id', 'isAreaOrg', 'name', 'slug'],
    )
  })

  it('returns null for an unknown slug', async () => {
    const t = makeT()
    const result = await t.query(api.organizations.publicBySlug, { slug: 'nope' })
    expect(result).toBeNull()
  })

  it('defaults isAreaOrg to false when the stored value is undefined', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('organizations', {
        name: 'Operator Test',
        slug: 'operator-test',
        createdAt: now,
        updatedAt: now,
      })
    })

    const result = await t.query(api.organizations.publicBySlug, { slug: 'operator-test' })
    expect(result?.isAreaOrg).toBe(false)
  })
})

describe('organizations.getBySlug — authenticated returns full org doc', () => {
  it('returns all stored fields for authenticated callers', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('organizations', {
        clerkOrgId: 'org_full_abc',
        name: 'Full Org',
        slug: 'full-org',
        phone: '+66123456789',
        email: 'admin@fullorg.com',
        destinationIds: [],
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|full-reader',
        slug: 'full-reader',
        email: 'reader@test.com',
        firstName: 'Full',
        lastName: 'Reader',
        appLanguage: 'en',
        ...TEST_USER_REQUIRED,
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|full-reader' })
      .query(api.organizations.getBySlug, { slug: 'full-org' })

    expect(result).not.toBeNull()
    expect(result).toHaveProperty('clerkOrgId', 'org_full_abc')
    expect(result).toHaveProperty('phone', '+66123456789')
    expect(result).toHaveProperty('email', 'admin@fullorg.com')
    expect(result).toHaveProperty('_creationTime')
  })
})
