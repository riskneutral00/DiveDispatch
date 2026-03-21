import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'

const modules = import.meta.glob('../../convex/**/*.ts')

const HOLD_TTL = 43_200_000

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function seedUser(ctx: Ctx, slug: string) {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test DC',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: 'DiveCenter' as any,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

async function seedBooking(ctx: Ctx, ownerId: string) {
  return ctx.db.insert('bookings', {
    ownerId,
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['DSD'],
    startDate: '2030-06-15',
    endDate: '2030-06-15',
    divers: [
      {
        name: 'Test Diver',
        abbrev: 'T',
        flag: { code: 'US', label: 'United States' },
        startDate: '2030-06-15',
        endDate: '2030-06-15',
        activityType: ['DSD'],
      },
    ],
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    expiresAt: Date.now() + HOLD_TTL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

// ── Tests: createBookingLink ──────────────────────────────────────────────────

describe('createBookingLink', () => {
  it('creates link + customerProfile atomically', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'link-dc-01')
      const bookingId = await seedBooking(ctx, 'link-dc-01')
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
    const { link, profile } = await t.run(async (ctx) => {
      const link = await ctx.db
        .query('bookingLinks')
        .withIndex('by_token', (q: Ctx) => q.eq('token', token))
        .unique()
      const profile = await ctx.db
        .query('customerProfiles')
        .withIndex('by_linkToken', (q: Ctx) => q.eq('linkToken', token))
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
    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'link-dc-02')
      const bookingId = await seedBooking(ctx, 'link-dc-02')
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
    const { linkCount, profileCount } = await t.run(async (ctx) => {
      const links = await ctx.db
        .query('bookingLinks')
        .withIndex('by_bookingId', (q: Ctx) => q.eq('bookingId', bookingId))
        .collect()
      const profiles = await ctx.db
        .query('customerProfiles')
        .withIndex('by_linkToken', (q: Ctx) => q.eq('linkToken', token1))
        .collect()
      return { linkCount: links.length, profileCount: profiles.length }
    })

    expect(linkCount).toBe(1)
    expect(profileCount).toBe(1)
  })

  it('excludes used tokens from idempotency check — creates new token', async () => {
    const t = convexTest(schema, modules)
    const { bookingId } = await t.run(async (ctx) => {
      await seedUser(ctx, 'link-dc-03')
      const bookingId = await seedBooking(ctx, 'link-dc-03')
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
    await t.run(async (ctx) => {
      const link = await ctx.db
        .query('bookingLinks')
        .withIndex('by_token', (q: Ctx) => q.eq('token', token1))
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
    const token = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-getby-01',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['DSD'],
        startDate: '2030-07-01',
        endDate: '2030-07-01',
        divers: [
          {
            name: 'Alice',
            abbrev: 'A',
            flag: { code: 'US', label: 'United States' },
            startDate: '2030-07-01',
            endDate: '2030-07-01',
            activityType: ['DSD'],
          },
        ],
        operatorName: 'Ocean DC',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
        expiresAt: Date.now() + HOLD_TTL,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const token = 'tok-getby-' + Math.random().toString(36).slice(2, 10)
      await ctx.db.insert('bookingLinks', {
        bookingId,
        token,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        customerName: 'Alice',
        email: 'alice@example.com',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      return token
    })

    const result = await t.query(api.bookingLinks.getByToken, { token })

    expect(result.status).toBe('valid')
    if (result.status === 'valid') {
      expect(result.customerName).toBe('Alice')
      expect(result.email).toBe('alice@example.com')
      expect(result.operatorName).toBe('Ocean DC')
      expect(result.activityType).toEqual(['DSD'])
      expect(result.startDate).toBe('2030-07-01')
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
