/**
 * Webhook idempotency — Clerk webhook duplicate detection
 *
 * Verifies:
 * 1. upsertFromWebhook with duplicate svixId is a no-op (second call skipped)
 * 2. deleteFromWebhook with duplicate svixId is a no-op
 * 3. Different svixIds for the same mutation both process normally
 * 4. Missing svixId preserves backwards compatibility (no guard applied)
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { internal } from '../convex/_generated/api'
import { seedUser } from './fixtures'
import { makeT } from './helpers/convex-helpers'

/** Generate a unique svixId per test to prevent cross-test collision. */
function makeSvixId(): string {
  return `msg_${crypto.randomUUID()}`
}

/** Generate a unique tokenIdentifier per test to prevent cross-test collision. */
function makeTokenIdentifier(label: string): string {
  return `clerk|${label}-${crypto.randomUUID().slice(0, 8)}`
}

// ── upsertFromWebhook idempotency ─────────────────────────────────────────

describe('upsertFromWebhook idempotency', () => {
  it('processes the first event normally', async () => {
    const t = makeT()
    const token = makeTokenIdentifier('first')
    const svixId = makeSvixId()

    const userId = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'user1@test.com',
      firstName: 'User',
      lastName: 'One',
      svixId,
    })

    expect(userId).not.toBeNull()

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', token),
        )
        .unique()
    })
    expect(user?.email).toBe('user1@test.com')
  })

  it('skips duplicate svixId on upsert (second call is no-op)', async () => {
    const t = makeT()
    const token = makeTokenIdentifier('dup')
    const svixId = makeSvixId()

    // First call — creates the user
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'original@test.com',
      firstName: 'Original',
      lastName: 'Name',
      svixId,
    })

    // Second call — same svixId, different data. Should be skipped.
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'updated@test.com',
      firstName: 'Updated',
      lastName: 'Name',
      svixId,
    })

    // User should still have original data (second call was no-op)
    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', token),
        )
        .unique()
    })

    expect(user?.email).toBe('original@test.com')

    // idempotencyLog should contain exactly one entry for this svixId
    const logEntries = await t.run(async (ctx) => {
      return await ctx.db
        .query('idempotencyLog')
        .withIndex('by_key_mutationName', (q) =>
          q.eq('key', svixId).eq('mutationName', 'clerk_webhook_upsert'),
        )
        .collect()
    })
    expect(logEntries).toHaveLength(1)
  })

  it('processes different svixIds independently', async () => {
    const t = makeT()
    const token = makeTokenIdentifier('multi')
    const svixIdA = makeSvixId()
    const svixIdB = makeSvixId()

    // First event — creates user
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'first@test.com',
      firstName: 'First',
      lastName: 'User',
      svixId: svixIdA,
    })

    // Second event — different svixId, updates user
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'second@test.com',
      firstName: 'Second',
      lastName: 'User',
      svixId: svixIdB,
    })

    // User should have data from second event (both processed)
    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', token),
        )
        .unique()
    })

    expect(user?.email).toBe('second@test.com')
  })
})

// ── deleteFromWebhook idempotency ─────────────────────────────────────────

describe('deleteFromWebhook idempotency', () => {
  beforeEach(() => { vi.useFakeTimers({ now: Date.now() }) })
  afterEach(() => { vi.useRealTimers() })

  it('anonymises user on first delete event', async () => {
    const t = makeT()
    const token = makeTokenIdentifier('delete')
    const svixId = makeSvixId()

    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: token,
        email: 'victim@test.com',
      })
    })

    await t.mutation(internal.users.deleteFromWebhook, {
      tokenIdentifier: token,
      svixId,
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', token),
        )
        .unique()
    })

    expect(user?.email).toBe('deleted@deleted.invalid')
  })

  it('skips duplicate svixId on delete (second call is no-op)', async () => {
    const t = makeT()
    const token = makeTokenIdentifier('delete-dup')
    const svixId = makeSvixId()

    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: token,
        email: 'target@test.com',
      })
    })

    // First call — anonymises the user
    await t.mutation(internal.users.deleteFromWebhook, {
      tokenIdentifier: token,
      svixId,
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    // Manually restore the email to prove second call is a no-op
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', token),
        )
        .unique()
      if (user) {
        await ctx.db.patch(user._id, { email: 'restored@test.com' })
      }
    })

    // Second call — same svixId, should be skipped
    await t.mutation(internal.users.deleteFromWebhook, {
      tokenIdentifier: token,
      svixId,
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    // Email should still be 'restored' (second call was no-op)
    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', token),
        )
        .unique()
    })

    expect(user?.email).toBe('restored@test.com')

    // idempotencyLog should contain exactly one entry for this svixId
    const logEntries = await t.run(async (ctx) => {
      return await ctx.db
        .query('idempotencyLog')
        .withIndex('by_key_mutationName', (q) =>
          q.eq('key', svixId).eq('mutationName', 'clerk_webhook_delete'),
        )
        .collect()
    })
    expect(logEntries).toHaveLength(1)
  })
})

// ── Backwards compatibility ───────────────────────────────────────────────

describe('webhook backwards compatibility', () => {
  it('upsertFromWebhook works without svixId (no guard applied)', async () => {
    const t = makeT()
    const token = makeTokenIdentifier('no-svix')

    // First call without svixId
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'first@test.com',
      firstName: 'First',
      lastName: 'User',
    })

    // Second call without svixId — should still process
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'second@test.com',
      firstName: 'Second',
      lastName: 'User',
    })

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', token),
        )
        .unique()
    })

    expect(user?.email).toBe('second@test.com')
  })

  it('deleteFromWebhook works without svixId (no guard applied)', async () => {
    vi.useFakeTimers({ now: Date.now() })
    const t = makeT()
    const token = makeTokenIdentifier('delete-no-svix')

    await t.run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: token,
        email: 'target@test.com',
      })
    })

    await t.mutation(internal.users.deleteFromWebhook, {
      tokenIdentifier: token,
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', token),
        )
        .unique()
    })

    expect(user?.email).toBe('deleted@deleted.invalid')
    vi.useRealTimers()
  })
})
