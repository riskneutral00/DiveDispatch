import { describe, it, expect } from 'vitest'
import { api, internal } from '../convex/_generated/api'
import type { Doc } from '../convex/_generated/dataModel'
import { seedUser, TEST_SLUGS } from './fixtures'
import { makeT } from './helpers/convex-helpers'

describe('users.upsertUser — removed', () => {
  it('is not exposed on the public API', () => {
    const userKeys = Object.getOwnPropertyNames(api.users)
    expect(userKeys).not.toContain('upsertUser')
  })
})


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

  it('converges on seed-stub user by email when tokenIdentifier differs', async () => {
    const t = makeT()
    let seedUserId: Doc<'users'>['_id']
    await t.run(async (ctx) => {
      seedUserId = await seedUser(ctx, {
        tokenIdentifier: 'seed|test-slug',
        email: 'converge@test.com',
        firstName: 'Seed',
        lastName: 'Stub',
        name: 'Seed Stub',
      })
    })

    const returnedId = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: 'https://clerk.example|user_abc',
      email: 'converge@test.com',
      name: 'Real Name',
      firstName: 'Real',
      lastName: 'Name',
    })

    expect(returnedId).toBe(seedUserId!)

    await t.run(async (ctx) => {
      const all = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', 'converge@test.com'))
        .collect()
      expect(all).toHaveLength(1)
      expect(all[0]._id).toBe(seedUserId!)
      expect(all[0].tokenIdentifier).toBe('https://clerk.example|user_abc')
      expect(all[0].firstName).toBe('Real')
      expect(all[0].lastName).toBe('Name')
      expect(all[0].name).toBe('Real Name')
    })
  })

  it('does not email-converge when email is empty string', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'seed|no-email',
        email: '',
      })
    })

    const newId = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: 'clerk|different',
      email: '',
      name: 'X',
      firstName: 'X',
      lastName: 'Y',
    })

    await t.run(async (ctx) => {
      const all = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', ''))
        .collect()
      expect(all).toHaveLength(2)
      expect(all.some((u) => u._id === newId)).toBe(true)
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

describe('users.upsertFromWebhook — userRoles', () => {
  it('does not assign any role when creating a new user (role selection owned by signup wizard)', async () => {
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
      expect(roles).toHaveLength(0)
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
      expect(roles).toHaveLength(1)
      expect(roles[0].role).toBe('DiveCenter')
    })
  })
})


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

  it('still includes public fields (name, slug)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, { name: 'Visible Name' })
    })

    const user = await t.query(api.users.bySlug, { slug: TEST_SLUGS.diveCenter })
    expect(user).not.toBeNull()
    expect(user!.name).toBe('Visible Name')
    expect(user!.slug).toBe(TEST_SLUGS.diveCenter)
    expect(typeof user!._id).toBe('string')
  })
})


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
