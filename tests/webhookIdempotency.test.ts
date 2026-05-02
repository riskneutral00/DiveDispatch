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
import type { MutationCtx } from '../convex/_generated/server'
import { seedUser } from './fixtures'
import { makeT } from './helpers/convex-helpers'
import { TEST_USER_REQUIRED } from './helpers/userDefaults'

async function seedUpsertUser(ctx: MutationCtx, token: string, email: string) {
  const orgId = await ctx.db.insert('organizations', {
    slug: `idem-${crypto.randomUUID().slice(0, 8)}`,
    name: 'Idempotency Test Org',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  return ctx.db.insert('users', {
    tokenIdentifier: token,
    slug: `idem-${crypto.randomUUID().slice(0, 8)}`,
    email,
    firstName: 'Seed',
    lastName: 'User',
    appLanguage: 'en',
    ...TEST_USER_REQUIRED,
    organizationId: orgId,
  })
}

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
  it('returns existing id for first event (post-stub-removal: requires pre-existing row)', async () => {
    const t = makeT()
    const token = makeTokenIdentifier('first')
    const svixId = makeSvixId()

    const seededId = await t.run(async (ctx) => seedUpsertUser(ctx, token, 'user1@test.com'))

    const userId = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'user1@test.com',
      firstName: 'User',
      lastName: 'One',
      svixId,
    })

    expect(userId).toBe(seededId)
  })

  it('skips duplicate svixId on upsert (second call is no-op)', async () => {
    const t = makeT()
    const token = makeTokenIdentifier('dup')
    const svixId = makeSvixId()

    await t.run(async (ctx) => seedUpsertUser(ctx, token, 'original@test.com'))

    // First call — patches the existing user
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'patched@test.com',
      firstName: 'Patched',
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

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', token),
        )
        .unique()
    })

    expect(user?.email).toBe('patched@test.com')

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

    await t.run(async (ctx) => seedUpsertUser(ctx, token, 'seed@test.com'))

    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'first@test.com',
      firstName: 'First',
      lastName: 'User',
      svixId: svixIdA,
    })

    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'second@test.com',
      firstName: 'Second',
      lastName: 'User',
      svixId: svixIdB,
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

  it('audit-logs user_created_skipped on no-match and does not duplicate audit on svix replay', async () => {
    const t = makeT()
    const token = makeTokenIdentifier('skip')
    const svixId = makeSvixId()

    const r1 = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'noone@test.com',
      firstName: 'No',
      lastName: 'One',
      svixId,
    })
    expect(r1).toBeNull()

    const r2 = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'noone@test.com',
      firstName: 'No',
      lastName: 'One',
      svixId,
    })
    expect(r2).toBeNull()

    const audit = await t.run(async (ctx) => {
      const all = await ctx.db.query('webhookAuditLog').collect()
      return all.filter((a) => a.eventType === 'user_created_skipped' && a.newTokenIdentifier === token)
    })
    expect(audit).toHaveLength(1)
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

    await t.run(async (ctx) => seedUpsertUser(ctx, token, 'seed@test.com'))

    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'first@test.com',
      firstName: 'First',
      lastName: 'User',
    })

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
