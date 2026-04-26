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

  it('rebinds an existing seed-only row (clerkOrgId undefined) by slug match instead of inserting a duplicate', async () => {
    const t = makeT()
    const seedOrgId = await t.run(async (ctx) => {
      const now = Date.now()
      return ctx.db.insert('organizations', {
        name: 'Sea Fun Divers',
        slug: 'sea-fun-divers',
        createdAt: now,
        updatedAt: now,
      })
    })

    const realClerkOrgId = makeClerkOrgId('sea-fun-real')
    const returnedId = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId: realClerkOrgId,
      name: 'Sea Fun Divers',
      slug: 'sea-fun-divers',
      svixId: makeSvixId(),
    })

    expect(returnedId).toBe(seedOrgId)

    const allMatching = await t.run(async (ctx) =>
      ctx.db.query('organizations').filter((q) => q.eq(q.field('name'), 'Sea Fun Divers')).collect(),
    )
    expect(allMatching.length).toBe(1)
    expect(allMatching[0].clerkOrgId).toBe(realClerkOrgId)
    expect(allMatching[0].slug).toBe('sea-fun-divers')
  })

  it('rebinds via name match when Clerk auto-suffixes the slug', async () => {
    const t = makeT()
    const seedOrgId = await t.run(async (ctx) => {
      const now = Date.now()
      return ctx.db.insert('organizations', {
        name: 'Dive Co',
        slug: 'dive-co',
        createdAt: now,
        updatedAt: now,
      })
    })

    const realClerkOrgId = makeClerkOrgId('dive-co-real')
    const returnedId = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId: realClerkOrgId,
      name: 'Dive Co',
      slug: 'dive-co-1234567890',
      svixId: makeSvixId(),
    })

    expect(returnedId).toBe(seedOrgId)

    const allByName = await t.run(async (ctx) =>
      ctx.db.query('organizations').filter((q) => q.eq(q.field('name'), 'Dive Co')).collect(),
    )
    expect(allByName.length).toBe(1)
    expect(allByName[0].clerkOrgId).toBe(realClerkOrgId)
    expect(allByName[0].slug).toBe('dive-co-1234567890')
  })

  it('does NOT rebind when the slug-matched row is already bound to a real Clerk org', async () => {
    const t = makeT()
    const realClerkOrgIdA = makeClerkOrgId('real-a')
    const existingOrgId = await t.run(async (ctx) => {
      const now = Date.now()
      return ctx.db.insert('organizations', {
        clerkOrgId: realClerkOrgIdA,
        name: 'Same Name',
        slug: 'same-slug',
        createdAt: now,
        updatedAt: now,
      })
    })

    const realClerkOrgIdB = makeClerkOrgId('real-b')
    const newOrgId = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId: realClerkOrgIdB,
      name: 'Same Name',
      slug: 'same-slug',
      svixId: makeSvixId(),
    })

    expect(newOrgId).not.toBe(existingOrgId)

    const allByName = await t.run(async (ctx) =>
      ctx.db.query('organizations').filter((q) => q.eq(q.field('name'), 'Same Name')).collect(),
    )
    expect(allByName.length).toBe(2)
  })
})

describe('organizations.deleteFromWebhook', () => {
  it('soft-deletes organization on delete event (sets deletedAt; org row remains)', async () => {
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
    expect(org).not.toBeNull()
    expect(org?.deletedAt).toBeTypeOf('number')
  })

  it('soft-delete hides org from publicByClerkOrgId and publicBySlug', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('hidden')

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Hidden',
      slug: 'hidden',
      svixId: makeSvixId(),
    })

    await t.mutation(internal.organizations.deleteFromWebhook, {
      clerkOrgId,
      svixId: makeSvixId(),
    })

    const byClerk = await t.query(api.organizations.publicByClerkOrgId, { clerkOrgId })
    const bySlug = await t.query(api.organizations.publicBySlug, { slug: 'hidden' })
    expect(byClerk).toBeNull()
    expect(bySlug).toBeNull()
  })

  it('soft-delete writes webhookAuditLog org_cascade_initiated with manifest counts', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('audit')

    const orgId = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Audit Test',
      slug: 'audit-test',
      svixId: makeSvixId(),
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('diveCenters', {
        organizationId: orgId,
        slug: 'dc-audit',
        name: 'Audit DC',
        address: { city: 'Phuket', country: 'TH' },
        lat: 7.88,
        lng: 98.39,
        email: 'audit@test.com',
        phone: '+66800000099',
        associations: [],
        verified: false,
      })
    })

    await t.mutation(internal.organizations.deleteFromWebhook, {
      clerkOrgId,
      svixId: makeSvixId(),
    })

    const auditEntries = await t.run(async (ctx) =>
      (await ctx.db.query('webhookAuditLog').collect()).filter(
        (e) => e.eventType === 'org_cascade_initiated' && e.orgId === orgId,
      ),
    )
    expect(auditEntries.length).toBe(1)
    expect(auditEntries[0].orgSlug).toBe('audit-test')
    expect(auditEntries[0].manifestCounts?.diveCenters).toBe(1)
  })

  it('a Clerk recreation upsert clears deletedAt and reactivates the org', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('revive')

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'To Revive',
      slug: 'to-revive',
      svixId: makeSvixId(),
    })
    await t.mutation(internal.organizations.deleteFromWebhook, {
      clerkOrgId,
      svixId: makeSvixId(),
    })
    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'To Revive',
      slug: 'to-revive',
      svixId: makeSvixId(),
    })

    const org = await t.run(async (ctx) =>
      ctx.db.query('organizations').withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId)).unique(),
    )
    expect(org?.deletedAt).toBeUndefined()
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

  it('soft-delete preserves child rows immediately (cascade is deferred to TTL cron)', async () => {
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
        slug: 'dc-cascade',
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

    expect(results.org).not.toBeNull()
    expect(results.org?.deletedAt).toBeTypeOf('number')
    expect(results.user?.organizationId).toBe(orgId)
    expect(results.userRole).not.toBeNull()
    expect(results.diveCenter).not.toBeNull()
  })

  it('soft-delete leaves other orgs untouched (no deletedAt on bystanders)', async () => {
    const t = makeT()
    const targetClerkOrgId = makeClerkOrgId('iso-target')
    const otherClerkOrgId = makeClerkOrgId('iso-other')

    const targetOrgId = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId: targetClerkOrgId,
      name: 'Target',
      slug: 'iso-target',
      svixId: makeSvixId(),
    })
    const otherOrgId = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId: otherClerkOrgId,
      name: 'Other',
      slug: 'iso-other',
      svixId: makeSvixId(),
    })

    await t.mutation(internal.organizations.deleteFromWebhook, {
      clerkOrgId: targetClerkOrgId,
      svixId: makeSvixId(),
    })

    const { target, other } = await t.run(async (ctx) => ({
      target: await ctx.db.get(targetOrgId),
      other: await ctx.db.get(otherOrgId),
    }))

    expect(target?.deletedAt).toBeTypeOf('number')
    expect(other?.deletedAt).toBeUndefined()
  })

  it('repeat soft-delete is a no-op (deletedAt stays at the first call value)', async () => {
    const t = makeT()
    const clerkOrgId = makeClerkOrgId('redel')

    await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Redel',
      slug: 'redel',
      svixId: makeSvixId(),
    })

    await t.mutation(internal.organizations.deleteFromWebhook, {
      clerkOrgId,
      svixId: makeSvixId(),
    })

    const firstDeletedAt = await t.run(async (ctx) => {
      const o = await ctx.db.query('organizations').withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId)).unique()
      return o?.deletedAt
    })

    await t.mutation(internal.organizations.deleteFromWebhook, {
      clerkOrgId,
      svixId: makeSvixId(),
    })

    const auditCount = await t.run(async (ctx) =>
      (await ctx.db.query('webhookAuditLog').collect()).filter((e) => e.eventType === 'org_cascade_initiated').length,
    )
    const secondDeletedAt = await t.run(async (ctx) => {
      const o = await ctx.db.query('organizations').withIndex('by_clerkOrgId', (q) => q.eq('clerkOrgId', clerkOrgId)).unique()
      return o?.deletedAt
    })

    expect(secondDeletedAt).toBe(firstDeletedAt)
    expect(auditCount).toBe(1)
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

    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|slug-reader',
        originalTokenIdentifier: 'clerk|slug-reader',
        slug: 'slug-reader',
        email: 'reader@test.com',
        name: 'Reader',
        firstName: 'Slug',
        lastName: 'Reader',
        appLanguage: 'en',
      })
    })

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|slug-reader' })
      .query(api.organizations.getBySlug, { slug: 'slug-test' })
    expect(result?.name).toBe('Slug Test')
    expect(result?.clerkOrgId).toBe(clerkOrgId)
  })

  it('throws UNAUTHENTICATED for unauthenticated caller', async () => {
    const t = makeT()
    await expectConvexError(
      t.query(api.organizations.getBySlug, { slug: 'slug-test' }),
      'UNAUTHENTICATED',
    )
  })

  it('returns null for unknown slug (authenticated)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|slug-reader',
        originalTokenIdentifier: 'clerk|slug-reader',
        slug: 'slug-reader',
        email: 'reader@test.com',
        name: 'Reader',
        firstName: 'Slug',
        lastName: 'Reader',
        appLanguage: 'en',
      })
    })

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
    const adminToken = 'clerk|admin-user'

    const orgId = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Admin Co',
      slug: 'admin-co',
      svixId: makeSvixId(),
    })

    await t.run(async (ctx) => {
      const uid = await ctx.db.insert('users', {
        tokenIdentifier: adminToken,
        originalTokenIdentifier: adminToken,
        slug: 'admin-user',
        email: 'admin-user@test.com',
        name: 'Admin User',
        firstName: 'Admin',
        lastName: 'User',
        appLanguage: 'en',
        organizationId: orgId,
      })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: orgId,
        createdAt: Date.now(),
      })
    })

    const adminIdentity = {
      tokenIdentifier: adminToken,
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
    const adminToken = 'clerk|admin-empty'

    const orgId = await t.mutation(internal.organizations.upsertFromWebhook, {
      clerkOrgId,
      name: 'Empty',
      slug: 'empty',
      svixId: makeSvixId(),
    })

    await t.run(async (ctx) => {
      const uid = await ctx.db.insert('users', {
        tokenIdentifier: adminToken,
        originalTokenIdentifier: adminToken,
        slug: 'admin-empty',
        email: 'admin-empty@test.com',
        name: 'Admin Empty',
        firstName: 'Admin',
        lastName: 'Empty',
        appLanguage: 'en',
        organizationId: orgId,
      })
      await ctx.db.insert('userRoles', {
        userId: uid,
        role: 'DiveCenter',
        organizationId: orgId,
        createdAt: Date.now(),
      })
    })

    await expectConvexError(
      t.withIdentity({
        tokenIdentifier: adminToken,
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
      'FORBIDDEN',
      'no_active_org',
    )
  })
})
