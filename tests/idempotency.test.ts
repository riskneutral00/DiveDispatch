/**
 * Idempotency guard — server-side tests
 *
 * Verifies:
 * 1. First mutation with a given key executes normally
 * 2. Duplicate mutation with same key is a no-op (single side effect)
 * 3. Different keys for same mutation both execute
 * 4. Missing key preserves backwards compatibility (no guard applied)
 * 5. Sequential duplicate call (simulates OCC retry path) is a no-op
 * 6. Idempotency log entries expire after 24 hours via purge job
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
        .withIndex('by_userId_createdAt', (q) => q.eq('userId', TEST_SLUGS.diveCenter))
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
        .withIndex('by_userId_createdAt', (q) => q.eq('userId', TEST_SLUGS.diveCenter))
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
        .withIndex('by_userId_createdAt', (q) => q.eq('userId', TEST_SLUGS.diveCenter))
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
        .withIndex('by_userId_createdAt', (q) => q.eq('userId', TEST_SLUGS.diveCenter))
        .collect()
    })

    // Both should be created — no idempotency guard without keys
    expect(notifications).toHaveLength(2)
  })
})

// ── Composite index: no cross-mutation collision ────────────────────────────

describe('Idempotency composite index', () => {
  it('same key + different mutation name both execute (no cross-mutation collision)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const key = 'shared-key-1'
    const identity = { tokenIdentifier: TEST_TOKENS.diveCenter }

    // First mutation: createNotification with key
    await t.withIdentity(identity)
      .mutation(api.notifications.createNotification, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'From createNotification',
        idempotencyKey: key,
      })

    // Verify the idempotency log has one entry for createNotification
    const logAfterFirst = await t.run(async (ctx) => {
      return await ctx.db.query('idempotencyLog').collect()
    })
    expect(logAfterFirst).toHaveLength(1)
    expect(logAfterFirst[0].mutationName).toBe('createNotification')

    // Same key, different mutation name (editBooking) — should NOT collide
    let bookingId: ReturnType<typeof seedBooking> extends Promise<infer T> ? T : never
    await t.run(async (ctx) => {
      bookingId = await seedBooking(ctx, { status: 'Upcoming' })
    })

    await t.withIdentity(identity)
      .mutation(api.bookings.edit.editBooking, {
        bookingId: bookingId!,
        idempotencyKey: key,
      })

    // editBooking should have executed (booking transitions to Draft)
    const booking = await t.run(async (ctx) => {
      return await ctx.db.get(bookingId!)
    })
    expect(booking!.status).toBe('Draft')

    // Verify the idempotency log now has two entries — one per mutation name
    const logAfterSecond = await t.run(async (ctx) => {
      return await ctx.db.query('idempotencyLog').collect()
    })
    expect(logAfterSecond).toHaveLength(2)

    const mutationNames = logAfterSecond.map((e) => e.mutationName).sort()
    expect(mutationNames).toEqual(['createNotification', 'editBooking'])
  })

  it('same key + same mutation name is still blocked (idempotency preserved)', async () => {
    const t = makeT()

    const key = 'composite-dup-key'

    // Insert a log entry directly
    await t.run(async (ctx) => {
      await ctx.db.insert('idempotencyLog', {
        key,
        mutationName: 'createNotification',
        createdAt: Date.now(),
      })
    })

    // Insert the same key + same mutationName — should find existing
    const isDuplicate = await t.run(async (ctx) => {
      const existing = await ctx.db
        .query('idempotencyLog')
        .withIndex('by_key_mutationName', (q) =>
          q.eq('key', key).eq('mutationName', 'createNotification'),
        )
        .unique()
      return existing !== null
    })

    expect(isDuplicate).toBe(true)
  })

  it('same key + different mutation name returns no match', async () => {
    const t = makeT()

    const key = 'composite-diff-key'

    // Insert a log entry for createNotification
    await t.run(async (ctx) => {
      await ctx.db.insert('idempotencyLog', {
        key,
        mutationName: 'createNotification',
        createdAt: Date.now(),
      })
    })

    // Query with same key but different mutationName — should NOT find existing
    const isDuplicate = await t.run(async (ctx) => {
      const existing = await ctx.db
        .query('idempotencyLog')
        .withIndex('by_key_mutationName', (q) =>
          q.eq('key', key).eq('mutationName', 'editBooking'),
        )
        .unique()
      return existing !== null
    })

    expect(isDuplicate).toBe(false)
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

// ── OCC retry path (sequential duplicate simulation) ────────────────────────

describe('Idempotency OCC retry path', () => {
  it('sequential duplicate call with same key+mutationName produces no side effect (simulates OCC retry)', async () => {
    // Simulates what happens when Convex retries a transaction after OCC conflict:
    // the second attempt reads the index range, finds the record inserted by the
    // first commit, and returns true (duplicate detected — no side effect).
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const key = 'occ-retry-key'
    const identity = { tokenIdentifier: TEST_TOKENS.diveCenter }

    // First call — inserts the idempotency record and creates the notification
    await t.withIdentity(identity)
      .mutation(api.notifications.createNotification, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'Original call',
        idempotencyKey: key,
      })

    // Second call — same key+mutationName, simulates what an OCC-retried
    // transaction would see: the record already exists, so it short-circuits
    await t.withIdentity(identity)
      .mutation(api.notifications.createNotification, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'Retried call',
        idempotencyKey: key,
      })

    // Only the original notification should exist
    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query('notifications')
        .withIndex('by_userId_createdAt', (q) => q.eq('userId', TEST_SLUGS.diveCenter))
        .collect()
    })

    expect(notifications).toHaveLength(1)
    expect(notifications[0].message).toBe('Original call')

    // Only one idempotency log entry should exist (not two)
    const logEntries = await t.run(async (ctx) => {
      return await ctx.db
        .query('idempotencyLog')
        .withIndex('by_key_mutationName', (q) =>
          q.eq('key', key).eq('mutationName', 'createNotification'),
        )
        .collect()
    })

    expect(logEntries).toHaveLength(1)
  })

  // Same key + different mutationName: both execute independently.
  // This is the complement of the OCC retry test — OCC only deduplicates
  // the exact (key, mutationName) pair, not the key alone.
  it('same key + different mutationName both execute (no cross-mutation dedup)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const key = 'occ-cross-mutation-key'
    const identity = { tokenIdentifier: TEST_TOKENS.diveCenter }

    // First mutation: createNotification
    await t.withIdentity(identity)
      .mutation(api.notifications.createNotification, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'From createNotification',
        idempotencyKey: key,
      })

    // Different mutation (editBooking) with same key — should execute
    let bookingId: ReturnType<typeof seedBooking> extends Promise<infer T> ? T : never
    await t.run(async (ctx) => {
      bookingId = await seedBooking(ctx, { status: 'Upcoming' })
    })

    await t.withIdentity(identity)
      .mutation(api.bookings.edit.editBooking, {
        bookingId: bookingId!,
        idempotencyKey: key,
      })

    // Both should have executed: notification created + booking edited
    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query('notifications')
        .withIndex('by_userId_createdAt', (q) => q.eq('userId', TEST_SLUGS.diveCenter))
        .collect()
    })
    expect(notifications).toHaveLength(1)

    const booking = await t.run(async (ctx) => {
      return await ctx.db.get(bookingId!)
    })
    expect(booking!.status).toBe('Draft')

    // Two idempotency log entries — one per mutation name
    const logEntries = await t.run(async (ctx) => {
      return await ctx.db.query('idempotencyLog').collect()
    })
    expect(logEntries).toHaveLength(2)
    const names = logEntries.map((e) => e.mutationName).sort()
    expect(names).toEqual(['createNotification', 'editBooking'])
  })
})

// ── Idempotency log expiry (24h TTL) ───────────────────────────────────────

describe('Idempotency log expiry', () => {
  it('purges entries older than 24 hours', async () => {
    const t = makeT()

    // Insert a stale log entry (25 hours old — past the 24h TTL)
    const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000
    await t.run(async (ctx) => {
      await ctx.db.insert('idempotencyLog', {
        key: 'stale-key',
        mutationName: 'notifications:createNotification',
        createdAt: twentyFiveHoursAgo,
      })
    })

    // Insert a fresh log entry (23 hours old — within the 24h TTL)
    const twentyThreeHoursAgo = Date.now() - 23 * 60 * 60 * 1000
    await t.run(async (ctx) => {
      await ctx.db.insert('idempotencyLog', {
        key: 'fresh-key',
        mutationName: 'notifications:createNotification',
        createdAt: twentyThreeHoursAgo,
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

  it('does not purge entries within 24h window', async () => {
    const t = makeT()

    // Insert an entry 12 hours old — well within the 24h TTL
    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000
    await t.run(async (ctx) => {
      await ctx.db.insert('idempotencyLog', {
        key: 'recent-key',
        mutationName: 'createNotification',
        createdAt: twelveHoursAgo,
      })
    })

    const purged = await t.mutation(internal.lib.idempotency.purgeExpiredIdempotencyKeys, {})

    expect(purged).toBe(0)

    const remaining = await t.run(async (ctx) => {
      return await ctx.db.query('idempotencyLog').collect()
    })
    expect(remaining).toHaveLength(1)
    expect(remaining[0].key).toBe('recent-key')
  })

  it('handles empty table gracefully', async () => {
    const t = makeT()
    const purged = await t.mutation(internal.lib.idempotency.purgeExpiredIdempotencyKeys, {})
    expect(purged).toBe(0)
  })
})
