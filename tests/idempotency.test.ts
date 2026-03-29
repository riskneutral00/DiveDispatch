/**
 * Idempotency guard — server-side tests
 *
 * Verifies:
 * 1. First mutation with a given key executes normally
 * 2. Duplicate mutation with same key is a no-op (single side effect)
 * 3. Different keys for same mutation both execute
 * 4. Missing key preserves backwards compatibility (no guard applied)
 * 5. Idempotency log entries expire after 1 hour via purge job
 */

import { describe, it, expect } from 'vitest'
import { api, internal } from '../convex/_generated/api'
import { seedUser, seedBooking, TEST_TOKENS, TEST_SLUGS } from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ── Idempotency Guard (server-side) ─────────────────────────────────────────

describe('Idempotency guard', () => {
  it('allows first mutation with a given idempotency key', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const key = 'test-key-unique-1'

    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.notifications.createNotification, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'Test notification',
        idempotencyKey: key,
      })

    const count = await t.run(async (ctx) => {
      const all = await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', TEST_SLUGS.diveCenter))
        .collect()
      return all.length
    })

    expect(count).toBe(1)
  })

  it('short-circuits duplicate mutation with same idempotency key', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const key = 'test-key-duplicate-1'
    const identity = { tokenIdentifier: TEST_TOKENS.diveCenter }

    // First call — should create notification
    await t.withIdentity(identity)
      .mutation(api.notifications.createNotification, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'First call',
        idempotencyKey: key,
      })

    // Second call — same key, should be a no-op
    await t.withIdentity(identity)
      .mutation(api.notifications.createNotification, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'Duplicate call',
        idempotencyKey: key,
      })

    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', TEST_SLUGS.diveCenter))
        .collect()
    })

    expect(notifications).toHaveLength(1)
    expect(notifications[0].message).toBe('First call')
  })

  it('allows different idempotency keys for same mutation name', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const identity = { tokenIdentifier: TEST_TOKENS.diveCenter }

    await t.withIdentity(identity)
      .mutation(api.notifications.createNotification, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'Notification A',
        idempotencyKey: 'key-a',
      })

    await t.withIdentity(identity)
      .mutation(api.notifications.createNotification, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'Notification B',
        idempotencyKey: 'key-b',
      })

    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', TEST_SLUGS.diveCenter))
        .collect()
    })

    expect(notifications).toHaveLength(2)
  })

  it('still works without idempotency key (backwards compatible)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const identity = { tokenIdentifier: TEST_TOKENS.diveCenter }

    await t.withIdentity(identity)
      .mutation(api.notifications.createNotification, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'No key notification',
      })

    await t.withIdentity(identity)
      .mutation(api.notifications.createNotification, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'Another no key notification',
      })

    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', TEST_SLUGS.diveCenter))
        .collect()
    })

    // Both should be created — no idempotency guard without keys
    expect(notifications).toHaveLength(2)
  })
})

// ── editBooking idempotency ──────────────────────────────────────────────────

describe('editBooking idempotency', () => {
  it('short-circuits duplicate editBooking call with same key', async () => {
    const t = makeT()
    let bookingId: ReturnType<typeof seedBooking> extends Promise<infer T> ? T : never
    await t.run(async (ctx) => {
      await seedUser(ctx)
      bookingId = await seedBooking(ctx, { status: 'Upcoming' })
    })

    const key = 'edit-key-1'
    const identity = { tokenIdentifier: TEST_TOKENS.diveCenter }

    // First call — should edit the booking (transition Upcoming -> Draft)
    await t.withIdentity(identity)
      .mutation(api.bookings.edit.editBooking, {
        bookingId: bookingId!,
        idempotencyKey: key,
      })

    // Verify booking is now Draft
    const afterFirst = await t.run(async (ctx) => {
      return await ctx.db.get(bookingId!)
    })
    expect(afterFirst!.status).toBe('Draft')

    // Manually set it back to Upcoming to prove the second call is a no-op
    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId!, { status: 'Upcoming' })
    })

    // Second call — same key, should be a no-op (booking stays Upcoming)
    await t.withIdentity(identity)
      .mutation(api.bookings.edit.editBooking, {
        bookingId: bookingId!,
        idempotencyKey: key,
      })

    const afterSecond = await t.run(async (ctx) => {
      return await ctx.db.get(bookingId!)
    })
    // If idempotency works, the booking should still be Upcoming (second call was no-op)
    expect(afterSecond!.status).toBe('Upcoming')
  })
})

// ── Idempotency log expiry ───────────────────────────────────────────────────

describe('Idempotency log expiry', () => {
  it('purges entries older than 1 hour', async () => {
    const t = makeT()

    // Insert a stale log entry (2 hours old)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    await t.run(async (ctx) => {
      await ctx.db.insert('idempotencyLog', {
        key: 'stale-key',
        mutationName: 'notifications:createNotification',
        createdAt: twoHoursAgo,
      })
    })

    // Insert a fresh log entry (5 minutes old)
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    await t.run(async (ctx) => {
      await ctx.db.insert('idempotencyLog', {
        key: 'fresh-key',
        mutationName: 'notifications:createNotification',
        createdAt: fiveMinAgo,
      })
    })

    // Run the purge
    const purged = await t.mutation(internal.lib.idempotency.purgeExpiredIdempotencyKeys, {})

    expect(purged).toBe(1)

    // Verify stale one is gone, fresh one remains
    const remaining = await t.run(async (ctx) => {
      return await ctx.db.query('idempotencyLog').collect()
    })

    expect(remaining).toHaveLength(1)
    expect(remaining[0].key).toBe('fresh-key')
  })

  it('handles empty table gracefully', async () => {
    const t = makeT()
    const purged = await t.mutation(internal.lib.idempotency.purgeExpiredIdempotencyKeys, {})
    expect(purged).toBe(0)
  })
})
