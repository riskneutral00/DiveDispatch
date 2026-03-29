import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import { type SeedCtx } from './fixtures'
import { makeT, expectConvexError } from './helpers/convex-helpers'

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedInstructorUser(ctx: SeedCtx, slug: string) {
  const userId = await ctx.db.insert('users', {
    tokenIdentifier: `user|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} User`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test',
    isSeeded: false,
    appLanguage: 'en',
  })
  await ctx.db.insert('userRoles', {
    userId,
    role: 'Instructor',
    createdAt: Date.now(),
    profileComplete: false,
  })
  return userId
}

async function seedInstructorProfile(ctx: SeedCtx, userId: Id<'users'>, name: string, placeName: string, country: string, verified = false) {
  return ctx.db.insert('instructors', {
    userId,
    name,
    placeName,
    country,
    lat: 7.8804,
    lng: 98.3923,
    email: `${userId}@test.com`,
    phone: '+66000000000',
    credential: [],
    verified,
  })
}

async function seedCallerUser(ctx: SeedCtx, slug: string) {
  const userId = await ctx.db.insert('users', {
    tokenIdentifier: `user|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} User`,
    firstName: slug,
    lastName: 'Caller',
    businessName: 'Dive Center',
    isSeeded: false,
    appLanguage: 'en',
  })
  await ctx.db.insert('userRoles', {
    userId,
    role: 'DiveCenter',
    createdAt: Date.now(),
    profileComplete: false,
  })
  return userId
}

// ─── listByRole: basic listing ────────────────────────────────────────────────

describe('listByRole basic listing', () => {
  it('returns all instructors with display fields', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedCallerUser(ctx, 'divecentre-phuket')
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', false)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|divecentre-phuket' })
      .query(api.directory.listByRole, { role: 'Instructor' })

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.slug)).toEqual(
      expect.arrayContaining(['john-abc', 'jane-def']),
    )
    expect(result[0]).toMatchObject({
      name: expect.any(String),
      placeName: expect.any(String),
      country: expect.any(String),
      verified: expect.any(Boolean),
      role: 'Instructor',
    })
  })

  it('returns empty array when no users exist for the role', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedCallerUser(ctx, 'caller-empty')
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|caller-empty' })
      .query(api.directory.listByRole, { role: 'Instructor' })
    expect(result).toHaveLength(0)
  })

  it('skips users whose profile row does not exist', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedCallerUser(ctx, 'caller-skip')
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      await seedInstructorUser(ctx, 'jane-def')
      // Only create profile for john-abc
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', true)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|caller-skip' })
      .query(api.directory.listByRole, { role: 'Instructor' })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('john-abc')
  })

  it('rejects unauthenticated callers with UNAUTHENTICATED error', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', true)
    })

    await expectConvexError(
      t.query(api.directory.listByRole, { role: 'Instructor' }),
      'UNAUTHENTICATED',
    )
  })
})

// ─── listByRole: location filter ─────────────────────────────────────────────

describe('listByRole location filter', () => {
  it('filters by placeName (case-insensitive)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedCallerUser(ctx, 'caller-place')
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', false)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|caller-place' })
      .query(api.directory.listByRole, { role: 'Instructor', placeName: 'phuket' })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('john-abc')
  })

  it('filters by country', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedCallerUser(ctx, 'caller-country')
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      const u3 = await seedInstructorUser(ctx, 'bali-guide')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', false)
      await seedInstructorProfile(ctx, u3, 'Bali Guide', 'Denpasar', 'Indonesia', true)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|caller-country' })
      .query(api.directory.listByRole, { role: 'Instructor', country: 'Thailand' })
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.country === 'Thailand')).toBe(true)
  })

  it('filters by both placeName and country', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedCallerUser(ctx, 'caller-both')
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      const u3 = await seedInstructorUser(ctx, 'tom-ghi')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', false)
      await seedInstructorProfile(ctx, u3, 'Tom Muller', 'Phuket', 'Thailand', true)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|caller-both' })
      .query(api.directory.listByRole, { role: 'Instructor', placeName: 'Krabi', country: 'Thailand' })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('jane-def')
  })

  it('returns empty when no match for placeName', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedCallerUser(ctx, 'caller-nomatch')
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', true)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|caller-nomatch' })
      .query(api.directory.listByRole, { role: 'Instructor', placeName: 'Bangkok' })
    expect(result).toHaveLength(0)
  })
})

// ─── listByRole: language propagation ────────────────────────────────────────

describe('listByRole language propagation', () => {
  it('returns teachingLanguages from instructor profile, not customerLanguages from users', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const callerId = await seedCallerUser(ctx, 'caller-lang')
      const u1 = await seedInstructorUser(ctx, 'inst-lang')
      // Set customerLanguages on user (should NOT appear in result)
      await ctx.db.patch(u1, { customerLanguages: ['fr-FR', 'de-DE'] })
      // Set teachingLanguages on instructor profile (SHOULD appear)
      await seedInstructorProfile(ctx, u1, 'Nattaya', 'Koh Tao', 'Thailand', true)
      const inst = await ctx.db.query('instructors')
        .withIndex('by_userId', (q) => q.eq('userId', u1))
        .unique()
      await ctx.db.patch(inst!._id, { teachingLanguages: ['en-GB', 'th-TH'] })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|caller-lang' })
      .query(api.directory.listByRole, { role: 'Instructor' })

    expect(result).toHaveLength(1)
    expect(result[0].languages).toEqual(['en-GB', 'th-TH'])
  })

  it('falls back to customerLanguages for non-instructor roles', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const callerId = await seedCallerUser(ctx, 'caller-lang-dc')
      // Seed a DiveCenter with customerLanguages on user
      const dcUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'user|dc-lang',
        slug: 'dc-lang',
        email: 'dc-lang@test.com',
        name: 'DC Lang',
        firstName: 'DC',
        lastName: 'Lang',
        businessName: 'DC Business',
        isSeeded: false,
        appLanguage: 'en',
        customerLanguages: ['ko-KR', 'ja-JP'],
      })
      await ctx.db.insert('userRoles', {
        userId: dcUserId,
        role: 'DiveCenter',
        createdAt: Date.now(),
        profileComplete: false,
      })
      await ctx.db.insert('diveCenters', {
        userId: dcUserId,
        name: 'Test DC',
        placeName: 'Koh Tao',
        country: 'Thailand',
        lat: 10.0957,
        lng: 99.8408,
        email: 'dc@test.com',
        phone: '+66123456789',
        associations: [{ agency: 'PADI', number: '12345' }],
        verified: true,
      })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|caller-lang-dc' })
      .query(api.directory.listByRole, { role: 'DiveCenter' })

    expect(result).toHaveLength(1)
    expect(result[0].languages).toEqual(['ko-KR', 'ja-JP'])
  })
})
