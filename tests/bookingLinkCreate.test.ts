/**
 * Booking Link Creation — Integration Tests
 *
 * Tests createBookingLink mutation: the atomic version that provisions
 * a customerProfiles row alongside the link.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUser, seedBooking, TEST_TOKENS, TEST_SLUGS } from './fixtures/seedFixture'
import { makeT } from './helpers/convex-helpers'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createBookingLink', () => {
  it('rejects unauthenticated caller', async () => {
    const t = makeT()
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx)
      bookingId = await seedBooking(ctx)
    })

    await expect(
      t.mutation(api.bookingLinks.createBookingLink, {
        bookingId,
        customerName: 'Alice',
        email: 'alice@test.com',
      }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when caller does not own booking', async () => {
    const t = makeT()
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx)
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.other,
        slug: TEST_SLUGS.other,
        role: 'DiveCenter',
      })
      bookingId = await seedBooking(ctx) // owned by TEST_SLUGS.diveCenter
    })

    await expect(
      t.withIdentity({ tokenIdentifier: TEST_TOKENS.other })
        .mutation(api.bookingLinks.createBookingLink, {
          bookingId,
          customerName: 'Alice',
          email: 'alice@test.com',
        }),
    ).rejects.toThrow()
  })

  it('creates link with token and provisions customerProfiles row', async () => {
    const t = makeT()
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx)
      bookingId = await seedBooking(ctx)
    })

    const token = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.bookingLinks.createBookingLink, {
        bookingId,
        customerName: 'Alice',
        email: 'alice@test.com',
      })

    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')

    // Verify link record exists
    await t.run(async (ctx) => {
      const link = await ctx.db
        .query('bookingLinks')
        .withIndex('by_token', (q) => q.eq('token', token as string))
        .unique()
      expect(link).toBeTruthy()
      expect(link!.customerName).toBe('Alice')
      expect(link!.email).toBe('alice@test.com')
      expect(link!.expiresAt).toBeGreaterThan(Date.now())

      // Verify customerProfiles row was provisioned atomically
      const profile = await ctx.db
        .query('customerProfiles')
        .filter((q) => q.eq(q.field('linkToken'), token))
        .unique()
      expect(profile).toBeTruthy()
      expect(profile!.bookingId).toEqual(bookingId)
    })
  })

  it('returns existing token on duplicate call (idempotent)', async () => {
    const t = makeT()
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx)
      bookingId = await seedBooking(ctx)
    })

    const identity = { tokenIdentifier: TEST_TOKENS.diveCenter }
    const args = { bookingId, customerName: 'Alice', email: 'alice@test.com' }

    const token1 = await t.withIdentity(identity).mutation(api.bookingLinks.createBookingLink, args)
    const token2 = await t.withIdentity(identity).mutation(api.bookingLinks.createBookingLink, args)

    expect(token1).toBe(token2)

    // Only one link row should exist
    await t.run(async (ctx) => {
      const links = await ctx.db
        .query('bookingLinks')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
        .collect()
      expect(links).toHaveLength(1)
    })
  })

  it('generated token is UUID format', async () => {
    const t = makeT()
    let bookingId: any
    await t.run(async (ctx) => {
      await seedUser(ctx)
      bookingId = await seedBooking(ctx)
    })

    const token = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.bookingLinks.createBookingLink, {
        bookingId,
        customerName: 'Bob',
        email: 'bob@test.com',
      })

    // UUID v4 format: 8-4-4-4-12 hex chars
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })
})
