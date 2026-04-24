import { describe, it, expect } from 'vitest'
import { api, internal } from '../convex/_generated/api'
import { makeT, expectConvexError } from './helpers/convex-helpers'

function makeSvixId(): string {
  return `msg_${crypto.randomUUID()}`
}

function makeClerkOrgId(label: string): string {
  return `org_${label}_${crypto.randomUUID().slice(0, 8)}`
}

describe('organizations.upsertFromWebhook', () => {
  it('inserts a new organization on first event', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('new')
    const svixId = makeSvixId()

    const id = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Hug Ocean Dive Center',
      slug: 'hug-ocean',
      svixId,
    })

    expect(id).not.toBeNull()

    const org = await t.run(async (ctx) => {
      return await ctx.db
        .query('organizations')
        .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
    })
    expect(org?.name).toBe('Hug Ocean Dive Center')
    expect(org?.slug).toBe('hug-ocean')
    expect(org?.createdAt).toBeGreaterThan(0)
    expect(org?.updatedAt).toBe(org?.createdAt)
  })

  it('updates existing organization on second event with same clerkOrgId', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('update')

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Old Name',
      slug: 'old-slug',
      svixId: makeSvixId(),
    })

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'New Name',
      slug: 'new-slug',
      svixId: makeSvixId(),
    })

    const rows = await t.run(async (ctx) => {
      return await ctx.db
        .query('organizations')
        .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
        .collect()
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('New Name')
    expect(rows[0].slug).toBe('new-slug')
    expect(rows[0].updatedAt).toBeGreaterThanOrEqual(rows[0].createdAt)
  })

  it('skips duplicate svixId (second call is a no-op)', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('dup')
    const svixId = makeSvixId()

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Original',
      slug: 'original',
      svixId,
    })

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Should Be Ignored',
      slug: 'ignored',
      svixId,
    })

    const org = await t.run(async (ctx) => {
      return await ctx.db
        .query('organizations')
        .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
    })
    expect(org?.name).toBe('Original')
    expect(org?.slug).toBe('original')

    const logEntries = await t.run(async (ctx) => {
      return await ctx.db
        .query('idempotencyLog')
        .withIndex('by_key_mutationName', (q) =>
          q.eq('key', svixId).eq('mutationName', 'clerk_org_upsert'),
        )
        .collect()
    })
    expect(logEntries).toHaveLength(1)
  })

  it('links creator user.organizationId when creatorTokenIdentifier is passed', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('creator-link')
    const tokenIdentifier = 'clerk|org-creator'

    const userId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {
        tokenIdentifier,
        originalTokenIdentifier: tokenIdentifier,
        slug: 'creator-slug',
        email: 'creator@test.com',
        name: 'Creator',
        firstName: 'Cre',
        lastName: 'Ator',
        appLanguage: 'en',
      })
    })

    const orgId = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Creator Org',
      slug: 'creator-org',
      svixId: makeSvixId(),
      creatorTokenIdentifier: tokenIdentifier,
    })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.organizationId).toBe(orgId)
  })

  it('silently skips link when creatorTokenIdentifier has no matching user', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('no-creator')

    const orgId = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Ghost Creator Org',
      slug: 'ghost-creator',
      svixId: makeSvixId(),
      creatorTokenIdentifier: 'clerk|does-not-exist',
    })

    expect(orgId).not.toBeNull()
  })

  it('works without svixId (backwards-compat no guard)', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('no-svix')

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'First',
      slug: 'first',
    })
    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Second',
      slug: 'second',
    })

    const org = await t.run(async (ctx) => {
      return await ctx.db
        .query('organizations')
        .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
    })
    expect(org?.name).toBe('Second')
  })
})

describe('organizations.deleteFromWebhook', () => {
  it('deletes organization on delete event', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('del')

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'To Delete',
      slug: 'to-delete',
      svixId: makeSvixId(),
    })

    await t.mutation(internal.organizations.deleteFromWebhook, {
      clerkOrgId,
      svixId: makeSvixId(),
    })

    const org = await t.run(async (ctx) => {
      return await ctx.db
        .query('organizations')
        .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
    })
    expect(org).toBeNull()
  })

  it('skips duplicate svixId on delete (second call is no-op)', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('del-dup')
    const svixId = makeSvixId()

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Will Be Restored',
      slug: 'restored',
      svixId: makeSvixId(),
    })

    await t.mutation(internal.organizations.deleteFromWebhook, {
      clerkOrgId,
      svixId,
    })

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Restored',
      slug: 'restored',
      svixId: makeSvixId(),
    })

    await t.mutation(internal.organizations.deleteFromWebhook, {
      clerkOrgId,
      svixId,
    })

    const org = await t.run(async (ctx) => {
      return await ctx.db
        .query('organizations')
        .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
    })
    expect(org?.name).toBe('Restored')
  })

  it('is a no-op when org does not exist', async () => {
    const t = makeT()

    await expect(
      t.mutation(internal.organizations.deleteFromWebhook, {
        clerkOrgId: makeClerkOrgId('ghost'),
        svixId: makeSvixId(),
      }),
    ).resolves.toBeNull()
  })

  it('cascades: unbinds users.organizationId + userRoles.organizationId, deletes role profile rows and grandchildren', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('cascade')

    const orgId = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Cascade Test Co',
      slug: 'cascade-co',
      svixId: makeSvixId(),
    })

    const {
      userId,
      userRoleId,
      diveCenterId,
    } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        tokenIdentifier: `clerk|cascade-user-${crypto.randomUUID().slice(0, 8)}`,
        originalTokenIdentifier: `clerk|cascade-user`,
        slug: 'cascade-user',
        email: 'cascade@test.com',
        name: 'Cascade User',
        firstName: 'Cascade',
        lastName: 'User',
        appLanguage: 'en',
        organizationId: orgId,
      })
      const userRoleId = await ctx.db.insert('userRoles', {
        userId,
        role: 'DiveCenter',
        createdAt: Date.now(),
        organizationId: orgId,
      })
      const diveCenterId = await ctx.db.insert('diveCenters', {
        organizationId: orgId,
        name: 'Cascade Dive Center',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.88,
        lng: 98.39,
        email: 'dc@test.com',
        phone: '+66800000001',
        associations: [],
        verified: false,
      })
      return {
        userId,
        userRoleId,
        diveCenterId,
      }
    })

    await t.mutation(internal.organizations.deleteFromWebhook, {
      clerkOrgId,
      svixId: makeSvixId(),
    })

    const results = await t.run(async (ctx) => ({
      user: await ctx.db.get(userId),
      userRole: await ctx.db.get(userRoleId),
      diveCenter: await ctx.db.get(diveCenterId),
      org: await ctx.db.get(orgId),
    }))

    expect(results.user?.organizationId).toBeUndefined()
    expect(results.user?.email).toBe('cascade@test.com')
    expect(results.userRole).toBeNull()
    expect(results.diveCenter).toBeNull()
    expect(results.org).toBeNull()
  })

  it('cascade leaves users from OTHER orgs untouched', async () => {
    const t = makeT()
    const targetClerkOrgId = makeClerkOrgId('cascade-target')
    const otherClerkOrgId = makeClerkOrgId('cascade-other')

    const targetOrgId = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId: targetClerkOrgId,
      name: 'Target',
      slug: 'target',
      svixId: makeSvixId(),
    })
    const otherOrgId = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId: otherClerkOrgId,
      name: 'Other',
      slug: 'other',
      svixId: makeSvixId(),
    })

    const { targetUserId, otherUserId } = await t.run(async (ctx) => {
      const targetUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|isolation-target',
        originalTokenIdentifier: 'clerk|isolation-target',
        slug: 'target-user',
        email: 'target@test.com',
        name: '',
        firstName: '',
        lastName: '',
        appLanguage: 'en',
        organizationId: targetOrgId,
      })
      const otherUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|isolation-other',
        originalTokenIdentifier: 'clerk|isolation-other',
        slug: 'other-user',
        email: 'other@test.com',
        name: '',
        firstName: '',
        lastName: '',
        appLanguage: 'en',
        organizationId: otherOrgId,
      })
      return { targetUserId, otherUserId }
    })

    await t.mutation(internal.organizations.deleteFromWebhook, {
      clerkOrgId: targetClerkOrgId,
      svixId: makeSvixId(),
    })

    const { targetUser, otherUser } = await t.run(async (ctx) => ({
      targetUser: await ctx.db.get(targetUserId),
      otherUser: await ctx.db.get(otherUserId),
    }))

    expect(targetUser?.organizationId).toBeUndefined()
    expect(otherUser?.organizationId).toBe(otherOrgId)
  })
})

describe('organizations.getBySlug', () => {
  it('returns the organization by slug', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('slug-lookup')

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Slug Test',
      slug: 'slug-test',
      svixId: makeSvixId(),
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|slug-reader' })
      .query(api.organizations.getBySlug, { slug: 'slug-test' })
    expect(result?.name).toBe('Slug Test')
    expect(result?.clerkOrgId).toBe(clerkOrgId)
  })

  it('returns null for unauthenticated caller', async () => {
    const t = makeT()
    const result = await t.query(api.organizations.getBySlug, { slug: 'slug-test' })
    expect(result).toBeNull()
  })

  it('returns null for unknown slug (authenticated)', async () => {
    const t = makeT()
    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|slug-reader' })
      .query(api.organizations.getBySlug, { slug: 'does-not-exist' })
    expect(result).toBeNull()
  })
})

describe('organizations.updateBusinessMetadata (admin gate)', () => {
  it('rejects when no active org is set on the identity', async () => {
    const t = makeT()

    await expectConvexError(
      t.withIdentity({ tokenIdentifier: 'clerk|no-org' }).mutation(
        api.organizations.updateBusinessMetadata,
        { phone: '+1-555-0000' },
      ),
      'FORBIDDEN',
    )
  })

  it('rejects when caller is a member (not admin)', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('member-gate')

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Member Gate Co',
      slug: 'member-gate',
      svixId: makeSvixId(),
    })

    const memberIdentity = {
      tokenIdentifier: 'clerk|member-user',
      orgId: clerkOrgId,
      orgRole: 'member',
      orgSlug: 'member-gate',
    }

    await expectConvexError(
      t.withIdentity(memberIdentity).mutation(
        api.organizations.updateBusinessMetadata,
        { phone: '+1-555-1111' },
      ),
      'FORBIDDEN',
    )
  })

  it('allows admins to patch metadata', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('admin-update')

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Admin Co',
      slug: 'admin-co',
      svixId: makeSvixId(),
    })

    const adminIdentity = {
      tokenIdentifier: 'clerk|admin-user',
      orgId: clerkOrgId,
      orgRole: 'admin',
      orgSlug: 'admin-co',
    }

    await t.withIdentity(adminIdentity).mutation(
      api.organizations.updateBusinessMetadata,
      { phone: '+66-80-123-4567', address: { city: 'Phuket', country: 'TH' } },
    )

    const org = await t.run(async (ctx) => {
      return await ctx.db
        .query('organizations')
        .withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
    })
    expect(org?.phone).toBe('+66-80-123-4567')
    expect(org?.address?.country).toBe('TH')
    expect(org?.name).toBe('Admin Co')
  })

  it('rejects when no fields are supplied', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('empty-update')

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Empty',
      slug: 'empty',
      svixId: makeSvixId(),
    })

    await expectConvexError(
      t.withIdentity({
        tokenIdentifier: 'clerk|admin-empty',
        orgId: clerkOrgId,
        orgRole: 'admin',
        orgSlug: 'empty',
      }).mutation(api.organizations.updateBusinessMetadata, {}),
      'VALIDATION',
    )
  })

  it('rejects when active org is not synced to Convex', async () => {
    const t = makeT()

    await expectConvexError(
      t.withIdentity({
        tokenIdentifier: 'clerk|orphan',
        orgId: 'org_orphan_unknown',
        orgRole: 'admin',
        orgSlug: 'orphan',
      }).mutation(api.organizations.updateBusinessMetadata, { phone: '+1' }),
      'NOT_FOUND',
    )
  })
})
