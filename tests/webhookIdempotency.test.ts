/**
 * Webhook idempotency — Clerk webhook duplicate detection
 *
 * Verifies:
 * 1. upsertFromWebhook with duplicate svixId is a no-op (second call skipped)
 * 2. deleteFromWebhook with duplicate svixId is a no-op
 * 3. Different svixIds for the same mutation both process normally
 * 4. Missing svixId preserves backwards compatibility (no guard applied)
 */

import { describe, it, expect } from 'vitest'
import { internal } from '../convex/_generated/api'
import { seedUser, TEST_TOKENS } from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ── upsertFromWebhook idempotency ─────────────────────────────────────────

describe('upsertFromWebhook idempotency', () => {
  it('processes the first event normally', async () => {
    const t = makeT()

    const userId = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: 'clerk|webhook-user-1',
      email: 'user1@test.com',
      name: 'User One',
      firstName: 'User',
      lastName: 'One',
      svixId: 'msg_first-event',
    })

    expect(userId).not.toBeNull()

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', 'clerk|webhook-user-1'),
        )
        .unique()
    })
    expect(user?.email).toBe('user1@test.com')
    expect(user?.name).toBe('User One')
  })

  it('skips duplicate svixId on upsert (second call is no-op)', async () => {
    const t = makeT()

    // First call — creates the user
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: 'clerk|webhook-dup',
      email: 'original@test.com',
      name: 'Original Name',
      firstName: 'Original',
      lastName: 'Name',
      svixId: 'msg_duplicate-upsert',
    })

    // Second call — same svixId, different data. Should be skipped.
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: 'clerk|webhook-dup',
      email: 'updated@test.com',
      name: 'Updated Name',
      firstName: 'Updated',
      lastName: 'Name',
      svixId: 'msg_duplicate-upsert',
    })

    // User should still have original data (second call was no-op)
    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', 'clerk|webhook-dup'),
        )
        .unique()
    })

    expect(user?.email).toBe('original@test.com')
    expect(user?.name).toBe('Original Name')
  })

  it('processes different svixIds independently', async () => {
    const t = makeT()

    // First event — creates user
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: 'clerk|webhook-multi',
      email: 'first@test.com',
      name: 'First',
      firstName: 'First',
      lastName: 'User',
      svixId: 'msg_event-a',
    })

    // Second event — different svixId, updates user
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: 'clerk|webhook-multi',
      email: 'second@test.com',
      name: 'Second',
      firstName: 'Second',
      lastName: 'User',
      svixId: 'msg_event-b',
    })

    // User should have data from second event (both processed)
    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', 'clerk|webhook-multi'),
        )
        .unique()
    })

    expect(user?.email).toBe('second@test.com')
    expect(user?.name).toBe('Second')
  })
})

// ── deleteFromWebhook idempotency ─────────────────────────────────────────

describe('deleteFromWebhook idempotency', () => {
  it('anonymises user on first delete event', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'clerk|delete-target',
        email: 'victim@test.com',
        name: 'Delete Me',
      })
    })

    await t.mutation(internal.users.deleteFromWebhook, {
      tokenIdentifier: 'clerk|delete-target',
      svixId: 'msg_delete-first',
    })

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', 'clerk|delete-target'),
        )
        .unique()
    })

    expect(user?.email).toBe('deleted@deleted.invalid')
    expect(user?.name).toBe('')
  })

  it('skips duplicate svixId on delete (second call is no-op)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'clerk|delete-dup',
        email: 'target@test.com',
        name: 'Target User',
      })
    })

    // First call — anonymises the user
    await t.mutation(internal.users.deleteFromWebhook, {
      tokenIdentifier: 'clerk|delete-dup',
      svixId: 'msg_delete-dup',
    })

    // Manually restore the email to prove second call is a no-op
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', 'clerk|delete-dup'),
        )
        .unique()
      if (user) {
        await ctx.db.patch(user._id, { email: 'restored@test.com' })
      }
    })

    // Second call — same svixId, should be skipped
    await t.mutation(internal.users.deleteFromWebhook, {
      tokenIdentifier: 'clerk|delete-dup',
      svixId: 'msg_delete-dup',
    })

    // Email should still be 'restored' (second call was no-op)
    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', 'clerk|delete-dup'),
        )
        .unique()
    })

    expect(user?.email).toBe('restored@test.com')
  })
})

// ── Backwards compatibility ───────────────────────────────────────────────

describe('webhook backwards compatibility', () => {
  it('upsertFromWebhook works without svixId (no guard applied)', async () => {
    const t = makeT()

    // First call without svixId
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: 'clerk|no-svix',
      email: 'first@test.com',
      name: 'First',
      firstName: 'First',
      lastName: 'User',
    })

    // Second call without svixId — should still process
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: 'clerk|no-svix',
      email: 'second@test.com',
      name: 'Second',
      firstName: 'Second',
      lastName: 'User',
    })

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', 'clerk|no-svix'),
        )
        .unique()
    })

    expect(user?.email).toBe('second@test.com')
  })

  it('deleteFromWebhook works without svixId (no guard applied)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: 'clerk|delete-no-svix',
        email: 'target@test.com',
        name: 'Target',
      })
    })

    await t.mutation(internal.users.deleteFromWebhook, {
      tokenIdentifier: 'clerk|delete-no-svix',
    })

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', 'clerk|delete-no-svix'),
        )
        .unique()
    })

    expect(user?.email).toBe('deleted@deleted.invalid')
  })
})
