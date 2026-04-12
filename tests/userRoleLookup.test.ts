/**
 * User Role & Lookup — Integration Tests
 *
 * Tests setRole, upsertFromWebhook, bySlug, and byId mutations/queries.
 * These are foundational to the auth model.
 */

import { describe, it, expect } from 'vitest'
import { api, internal } from '../convex/_generated/api'
import type { Doc } from '../convex/_generated/dataModel'
import { seedUser, TEST_TOKENS, TEST_SLUGS } from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ─── setRole ─────────────────────────────────────────────────────────────────

describe('users.setRole', () => {
  it('rejects unauthenticated caller', async () => {
    const t = makeT()
    await expect(
      t.mutation(api.users.setRole, { role: 'Instructor', businessName: 'Test' }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when user record does not exist', async () => {
    const t = makeT()
    // Identity exists but no users row
    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|ghost' })
        .mutation(api.users.setRole, { role: 'Instructor', businessName: 'Test' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('updates businessName (role no longer written to users table)', async () => {
    const t = makeT()
    let userId: Doc<'users'>['_id']
    await t.run(async (ctx) => {
      userId = await seedUser(ctx)
    })

    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.users.setRole, { role: 'Instructor', businessName: 'New Biz' })

    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId!) as Doc<'users'> | null
      expect(user!.businessName).toBe('New Biz')
    })
  })

  it('preserves other user fields when updating role', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { email: 'keep@test.com', firstName: 'Keep' })
    })

    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.users.setRole, { role: 'Boat', businessName: 'Boat Co' })

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', TEST_SLUGS.diveCenter))
        .unique()
      expect(user!.email).toBe('keep@test.com')
      expect(user!.firstName).toBe('Keep')
    })
  })
})

// ─── DD-132: upsertUser removed (security) ─────────────────────────────────

describe('users.upsertUser — removed', () => {
  it('is not exposed on the public API', () => {
    // upsertUser was a public mutation accepting caller-supplied tokenIdentifier
    // with no auth check. It has been deleted; upsertFromWebhook (internalMutation)
    // is the only user-creation-via-webhook path.
    const userKeys = Object.getOwnPropertyNames(api.users)
    expect(userKeys).not.toContain('upsertUser')
  })
})

// ─── upsertFromWebhook ─────────────────────────────────────────────────────

describe('users.upsertFromWebhook', () => {
  it('creates new user when none exists', async () => {
    const t = makeT()

    const userId = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: 'clerk|brand-new',
      email: 'new@test.com',
      name: 'New User',
      firstName: 'New',
      lastName: 'User',
    })

    expect(typeof userId).toBe('string')
    expect(userId.length).toBeGreaterThan(0)

    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      expect(user).not.toBeNull()
      expect(user!.email).toBe('new@test.com')
      expect(user!.slug).toBeTruthy()
    })
  })

  it('patches existing user on duplicate tokenIdentifier (idempotent)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: 'clerk|existing' })
    })

    const userId = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: 'clerk|existing',
      email: 'updated@test.com',
      name: 'Updated Name',
      firstName: 'Updated',
      lastName: 'Name',
    })

    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      expect(user!.email).toBe('updated@test.com')
      expect(user!.name).toBe('Updated Name')
    })
  })
})

// ─── upsertFromWebhook — userRoles seeding ─────────────────────────────────

describe('users.upsertFromWebhook — userRoles', () => {
  it('seeds a default DiveCenter userRoles entry when creating a new user', async () => {
    const t = makeT()

    const userId = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: 'clerk|roles-test',
      email: 'roles@test.com',
      name: 'Roles User',
      firstName: 'Roles',
      lastName: 'User',
    })

    await t.run(async (ctx) => {
      const roles = await ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect()
      expect(roles).toHaveLength(1)
      expect(roles[0].role).toBe('DiveCenter')
      expect(roles[0].profileComplete).toBe(false)
    })
  })

  it('does NOT create userRoles when upserting an existing user', async () => {
    const t = makeT()
    let userId: Doc<'users'>['_id']
    await t.run(async (ctx) => {
      userId = await seedUser(ctx, { tokenIdentifier: 'clerk|existing-roles' })
    })

    // Upsert same user — should only patch, not insert new userRoles
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: 'clerk|existing-roles',
      email: 'updated@test.com',
      name: 'Updated',
      firstName: 'Up',
      lastName: 'Dated',
    })

    await t.run(async (ctx) => {
      const roles = await ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId!))
        .collect()
      // Should still have only the original seeded role, not a second one
      expect(roles).toHaveLength(1)
      expect(roles[0].role).toBe('DiveCenter')
    })
  })
})

// ─── bySlug ──────────────────────────────────────────────────────────────────

describe('users.bySlug', () => {
  it('returns user by slug', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const user = await t.query(api.users.bySlug, { slug: TEST_SLUGS.diveCenter })
    expect(user).not.toBeNull()
    expect(user!.slug).toBe(TEST_SLUGS.diveCenter)
  })

  it('returns null for non-existent slug', async () => {
    const t = makeT()
    const user = await t.query(api.users.bySlug, { slug: 'does-not-exist' })
    expect(user).toBeNull()
  })

  it('omits tokenIdentifier from response', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const user = await t.query(api.users.bySlug, { slug: TEST_SLUGS.diveCenter })
    expect(user).not.toBeNull()
    expect('tokenIdentifier' in user!).toBe(false)
  })

  it('omits email from response', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const user = await t.query(api.users.bySlug, { slug: TEST_SLUGS.diveCenter })
    expect(user).not.toBeNull()
    expect('email' in user!).toBe(false)
  })

  it('still includes public fields (name, businessName, slug)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { name: 'Visible Name', businessName: 'Visible Biz' })
    })

    const user = await t.query(api.users.bySlug, { slug: TEST_SLUGS.diveCenter })
    expect(user).not.toBeNull()
    expect(user!.name).toBe('Visible Name')
    expect(user!.businessName).toBe('Visible Biz')
    expect(user!.slug).toBe(TEST_SLUGS.diveCenter)
    expect(typeof user!._id).toBe('string')
  })
})

// ─── byId ────────────────────────────────────────────────────────────────────

describe('users.byId', () => {
  it('returns user by ID', async () => {
    const t = makeT()
    let userId: Doc<'users'>['_id']
    await t.run(async (ctx) => {
      userId = await seedUser(ctx)
    })

    const user = await t.query(api.users.byId, { id: userId! })
    expect(user).not.toBeNull()
    expect(user!.slug).toBe(TEST_SLUGS.diveCenter)
  })

  it('omits tokenIdentifier from response', async () => {
    const t = makeT()
    let userId: Doc<'users'>['_id']
    await t.run(async (ctx) => {
      userId = await seedUser(ctx)
    })

    const user = await t.query(api.users.byId, { id: userId! })
    expect(user).not.toBeNull()
    expect('tokenIdentifier' in user!).toBe(false)
  })

  it('omits email from response', async () => {
    const t = makeT()
    let userId: Doc<'users'>['_id']
    await t.run(async (ctx) => {
      userId = await seedUser(ctx)
    })

    const user = await t.query(api.users.byId, { id: userId! })
    expect(user).not.toBeNull()
    expect('email' in user!).toBe(false)
  })
})
