/**
 * User Role & Lookup — Integration Tests
 *
 * Tests setRole, upsertUser, bySlug, and byId mutations/queries.
 * These are foundational to the auth model.
 */

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { seedUser, TEST_TOKENS, TEST_SLUGS } from './fixtures/seedFixture'

const modules = import.meta.glob('../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

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

  it('updates role and businessName', async () => {
    const t = makeT()
    let userId: any
    await t.run(async (ctx) => {
      userId = await seedUser(ctx)
    })

    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.users.setRole, { role: 'Instructor', businessName: 'New Biz' })

    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      expect(user!.role).toBe('Instructor')
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
      expect(user!.role).toBe('Boat')
    })
  })
})

// ─── upsertUser ──────────────────────────────────────────────────────────────

describe('users.upsertUser', () => {
  it('creates new user when none exists', async () => {
    const t = makeT()

    const userId = await t.mutation(api.users.upsertUser, {
      tokenIdentifier: 'clerk|brand-new',
      email: 'new@test.com',
      name: 'New User',
      firstName: 'New',
      lastName: 'User',
      role: 'Instructor',
    })

    expect(userId).toBeTruthy()

    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId as any)
      expect(user!.email).toBe('new@test.com')
      expect(user!.role).toBe('Instructor')
      expect(user!.slug).toBeTruthy()
    })
  })

  it('patches existing user on duplicate tokenIdentifier (idempotent)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { tokenIdentifier: 'clerk|existing' })
    })

    const userId = await t.mutation(api.users.upsertUser, {
      tokenIdentifier: 'clerk|existing',
      email: 'updated@test.com',
      name: 'Updated Name',
      firstName: 'Updated',
      lastName: 'Name',
      role: 'Instructor', // role should NOT be updated on existing user
    })

    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId as any)
      expect(user!.email).toBe('updated@test.com')
      expect(user!.name).toBe('Updated Name')
      // Role is NOT updated on existing users
      expect(user!.role).toBe('DiveCenter')
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
    expect(user).toBeTruthy()
    expect(user!.slug).toBe(TEST_SLUGS.diveCenter)
  })

  it('returns null for non-existent slug', async () => {
    const t = makeT()
    const user = await t.query(api.users.bySlug, { slug: 'does-not-exist' })
    expect(user).toBeNull()
  })
})

// ─── byId ────────────────────────────────────────────────────────────────────

describe('users.byId', () => {
  it('returns user by ID', async () => {
    const t = makeT()
    let userId: any
    await t.run(async (ctx) => {
      userId = await seedUser(ctx)
    })

    const user = await t.query(api.users.byId, { id: userId })
    expect(user).toBeTruthy()
    expect(user!.slug).toBe(TEST_SLUGS.diveCenter)
  })
})
