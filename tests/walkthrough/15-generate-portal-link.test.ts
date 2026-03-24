import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import { testDate, testToken } from '../helpers/dates'
import { seedUser, seedBooking, seedBookingLink, type SeedCtx } from '../fixtures/seedFixture'

const modules = import.meta.glob('../../convex/**/*.ts')

// ── Tests: createBookingLink ──────────────────────────────────────────────────

describe('createBookingLink', () => {
  it('creates link + customerProfile atomically', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { slug: 'link-dc-01', tokenIdentifier: 'clerk|link-dc-01' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'link-dc-01',
        activityType: ['DSD'],
        bookingFormComplete: false,
        divers: [
          {
            name: 'Test Diver',
            abbrev: 'T',
            flag: { code: 'US', label: 'United States' },
            startDate: testDate(5),
            endDate: testDate(5),
            activityType: ['DSD'],
          },
        ],
        expiresAt: Date.now() + 43_200_000,
      })
      return { bookingId }
    })

    const token = await t
      .withIdentity({ tokenIdentifier: 'clerk|link-dc-01' })
      .mutation(api.bookingLinks.createBookingLink, {
        bookingId,
        customerName: 'Test Diver',
        email: 'test@example.com',
      })

    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)

    // Verify bookingLink was created
    const { link, profile } = await t.run(async (ctx: SeedCtx) => {
      const link = await ctx.db
        .query('bookingLinks')
        .withIndex('by_token', (q) => q.eq('token', token))
        .unique()
      const profile = await ctx.db
        .query('customerProfiles')
        .withIndex('by_linkToken', (q) => q.eq('linkToken', token))
        .unique()
      return { link, profile }
    })

    expect(link).not.toBeNull()
    expect(link!.bookingId).toBe(bookingId)
    expect(link!.customerName).toBe('Test Diver')
    expect(link!.email).toBe('test@example.com')

    // CustomerProfile slot created atomically
    expect(profile).not.toBeNull()
    expect(profile!.bookingId).toBe(bookingId)
    expect(profile!.linkToken).toBe(token)
  })

  it('is idempotent — returns existing token for same booking', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { slug: 'link-dc-02', tokenIdentifier: 'clerk|link-dc-02' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'link-dc-02',
        activityType: ['DSD'],
        bookingFormComplete: false,
        divers: [
          {
            name: 'Test Diver',
            abbrev: 'T',
            flag: { code: 'US', label: 'United States' },
            startDate: testDate(5),
            endDate: testDate(5),
            activityType: ['DSD'],
          },
        ],
        expiresAt: Date.now() + 43_200_000,
      })
      return { bookingId }
    })

    const args = { bookingId, customerName: 'Test Diver', email: 'test@example.com' }

    const token1 = await t
      .withIdentity({ tokenIdentifier: 'clerk|link-dc-02' })
      .mutation(api.bookingLinks.createBookingLink, args)

    const token2 = await t
      .withIdentity({ tokenIdentifier: 'clerk|link-dc-02' })
      .mutation(api.bookingLinks.createBookingLink, args)

    expect(token2).toBe(token1)

    // Only one bookingLink and one customerProfile created
    const { linkCount, profileCount } = await t.run(async (ctx: SeedCtx) => {
      const links = await ctx.db
        .query('bookingLinks')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
        .collect()
      const profiles = await ctx.db
        .query('customerProfiles')
        .withIndex('by_linkToken', (q) => q.eq('linkToken', token1))
        .collect()
      return { linkCount: links.length, profileCount: profiles.length }
    })

    expect(linkCount).toBe(1)
    expect(profileCount).toBe(1)
  })

  it('excludes used tokens from idempotency check — creates new token', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await t.run(async (ctx: SeedCtx) => {
      await seedUser(ctx, { slug: 'link-dc-03', tokenIdentifier: 'clerk|link-dc-03' })
      const bookingId = await seedBooking(ctx, {
        ownerId: 'link-dc-03',
        activityType: ['DSD'],
        bookingFormComplete: false,
        divers: [
          {
            name: 'Test Diver',
            abbrev: 'T',
            flag: { code: 'US', label: 'United States' },
            startDate: testDate(5),
            endDate: testDate(5),
            activityType: ['DSD'],
          },
        ],
        expiresAt: Date.now() + 43_200_000,
      })
      return { bookingId }
    })

    // Create first token
    const token1 = await t
      .withIdentity({ tokenIdentifier: 'clerk|link-dc-03' })
      .mutation(api.bookingLinks.createBookingLink, {
        bookingId,
        customerName: 'Test Diver',
        email: 'test@example.com',
      })

    // Mark the first link as used
    await t.run(async (ctx: SeedCtx) => {
      const link = await ctx.db
        .query('bookingLinks')
        .withIndex('by_token', (q) => q.eq('token', token1))
        .unique()
      if (link) await ctx.db.patch(link._id, { usedAt: Date.now() })
    })

    // Second call should create a new token since first is used
    const token2 = await t
      .withIdentity({ tokenIdentifier: 'clerk|link-dc-03' })
      .mutation(api.bookingLinks.createBookingLink, {
        bookingId,
        customerName: 'Test Diver',
        email: 'test@example.com',
      })

    expect(token2).not.toBe(token1)
    expect(token2.length).toBeGreaterThan(0)
  })
})

// ── Tests: getByToken ─────────────────────────────────────────────────────────

describe('getByToken', () => {
  it('returns valid status with correct fields', async () => {
    const t = convexTest(schema, modules)
    const token = await t.run(async (ctx: SeedCtx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-getby-01',
        activityType: ['DSD'],
        startDate: testDate(10),
        endDate: testDate(10),
        divers: [
          {
            name: 'Alice',
            abbrev: 'A',
            flag: { code: 'US', label: 'United States' },
            startDate: testDate(10),
            endDate: testDate(10),
            activityType: ['DSD'],
          },
        ],
        operatorName: 'Ocean DC',
        bookingFormComplete: false,
        expiresAt: Date.now() + 43_200_000,
      })

      const token = testToken('tok-getby')
      await seedBookingLink(ctx, bookingId, {
        token,
        customerName: 'Alice',
        email: 'alice@example.com',
      })

      return token
    })

    const result = await t.query(api.bookingLinks.getByToken, { token })

    expect(result.status).toBe('valid')
    if (result.status === 'valid') {
      expect(result.customerName).toBe('Alice')
      expect(result.email).toBe('alice@example.com')
      expect(result.operatorName).toBe('Ocean DC')
      expect(result.activityType).toEqual(['DSD'])
      expect(result.startDate).toBe(testDate(10))
      expect(result.diverCount).toBe(1)
    }
  })

  it('returns not_found for unknown token', async () => {
    const t = convexTest(schema, modules)
    const result = await t.query(api.bookingLinks.getByToken, {
      token: 'does-not-exist-tok',
    })
    expect(result.status).toBe('not_found')
  })
})
