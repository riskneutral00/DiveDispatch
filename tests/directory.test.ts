import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { getBannedSlugSet } from '../convex/directory'

const modules = import.meta.glob('../convex/**/*.ts')

import type { Id } from '../convex/_generated/dataModel'
import { type SeedCtx } from './fixtures/seedFixture'

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedInstructorUser(ctx: SeedCtx, slug: string) {
  return ctx.db.insert('users', {
    tokenIdentifier: `user|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} User`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test',
    role: 'Instructor',
    isSeeded: false,
    preferredLocale: 'en',
  })
}

async function seedInstructorProfile(ctx: SeedCtx, userId: Id<'users'>, name: string, placeName: string, country: string, languages: string[], verified = false) {
  return ctx.db.insert('instructors', {
    userId,
    name,
    placeName,
    country,
    lat: 7.8804,
    lng: 98.3923,
    contactEmail: `${userId}@test.com`,
    contactPhone: '+66000000000',
    credential: [],
    languages,
    verified,
  })
}

async function seedCallerUser(ctx: SeedCtx, slug: string) {
  return ctx.db.insert('users', {
    tokenIdentifier: `user|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} User`,
    firstName: slug,
    lastName: 'Caller',
    businessName: 'Dive Center',
    role: 'DiveCenter',
    isSeeded: false,
    preferredLocale: 'en',
  })
}

// ─── getBannedSlugSet ─────────────────────────────────────────────────────────

describe('getBannedSlugSet', () => {
  it('returns empty set when no bans exist', async () => {
    const t = convexTest(schema, modules)
    const result = await t.run(async (ctx) => {
      const set = await getBannedSlugSet(ctx.db, 'some-slug')
      return [...set]
    })
    expect(result).toHaveLength(0)
  })

  it('includes slugs where caller is the banner', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('bans', { bannerSlug: 'caller', bannedSlug: 'target-a', createdAt: 1 })
    })
    const result = await t.run(async (ctx) => {
      const set = await getBannedSlugSet(ctx.db, 'caller')
      return [...set]
    })
    expect(result).toContain('target-a')
    expect(result).toHaveLength(1)
  })

  it('includes slugs where caller is the banned party', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('bans', { bannerSlug: 'aggressor', bannedSlug: 'caller', createdAt: 1 })
    })
    const result = await t.run(async (ctx) => {
      const set = await getBannedSlugSet(ctx.db, 'caller')
      return [...set]
    })
    expect(result).toContain('aggressor')
    expect(result).toHaveLength(1)
  })

  it('unions both directions and deduplicates', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('bans', { bannerSlug: 'caller', bannedSlug: 'a', createdAt: 1 })
      await ctx.db.insert('bans', { bannerSlug: 'b', bannedSlug: 'caller', createdAt: 2 })
    })
    const result = await t.run(async (ctx) => {
      const set = await getBannedSlugSet(ctx.db, 'caller')
      return [...set]
    })
    expect(result).toContain('a')
    expect(result).toContain('b')
    expect(result).toHaveLength(2)
  })
})

// ─── listByRole: basic listing ────────────────────────────────────────────────

describe('listByRole basic listing', () => {
  it('returns all instructors with display fields when caller has no bans', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedCallerUser(ctx, 'divecentre-phuket')
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', ['en', 'th'], true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', ['en', 'zh'], false)
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
      languages: expect.any(Array),
      verified: expect.any(Boolean),
      role: 'Instructor',
    })
  })

  it('returns empty array when no users exist for the role', async () => {
    const t = convexTest(schema, modules)

    const result = await t.query(api.directory.listByRole, { role: 'Instructor' })
    expect(result).toHaveLength(0)
  })

  it('skips users whose profile row does not exist', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      await seedInstructorUser(ctx, 'jane-def')
      // Only create profile for john-abc
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', ['en'], true)
    })

    const result = await t.query(api.directory.listByRole, { role: 'Instructor' })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('john-abc')
  })

  it('works unauthenticated — no ban filtering applied', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', ['en'], true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', ['en'], false)
    })

    const result = await t.query(api.directory.listByRole, { role: 'Instructor' })
    expect(result).toHaveLength(2)
  })
})

// ─── listByRole: ban filtering ────────────────────────────────────────────────

describe('listByRole ban filtering', () => {
  it('hides a stakeholder that the caller has banned', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedCallerUser(ctx, 'divecentre-phuket')
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', ['en'], true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', ['en'], false)
      await ctx.db.insert('bans', { bannerSlug: 'divecentre-phuket', bannedSlug: 'john-abc', createdAt: 1 })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|divecentre-phuket' })
      .query(api.directory.listByRole, { role: 'Instructor' })

    const slugs = result.map((r) => r.slug)
    expect(slugs).not.toContain('john-abc')
    expect(slugs).toContain('jane-def')
  })

  it('hides a stakeholder who has banned the caller (bidirectional)', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedCallerUser(ctx, 'divecentre-phuket')
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', ['en'], true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', ['en'], false)
      // jane-def banned the caller
      await ctx.db.insert('bans', { bannerSlug: 'jane-def', bannedSlug: 'divecentre-phuket', createdAt: 1 })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|divecentre-phuket' })
      .query(api.directory.listByRole, { role: 'Instructor' })

    const slugs = result.map((r) => r.slug)
    expect(slugs).not.toContain('jane-def')
    expect(slugs).toContain('john-abc')
  })

  it('hides all banned stakeholders when multiple bans exist', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedCallerUser(ctx, 'divecentre-phuket')
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      const u3 = await seedInstructorUser(ctx, 'tom-ghi')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', ['en'], true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', ['en'], false)
      await seedInstructorProfile(ctx, u3, 'Tom Müller', 'Phuket', 'Thailand', ['de', 'en'], true)
      await ctx.db.insert('bans', { bannerSlug: 'divecentre-phuket', bannedSlug: 'john-abc', createdAt: 1 })
      await ctx.db.insert('bans', { bannerSlug: 'tom-ghi', bannedSlug: 'divecentre-phuket', createdAt: 2 })
    })

    const result = await t.withIdentity({ tokenIdentifier: 'user|divecentre-phuket' })
      .query(api.directory.listByRole, { role: 'Instructor' })

    const slugs = result.map((r) => r.slug)
    expect(slugs).not.toContain('john-abc')
    expect(slugs).not.toContain('tom-ghi')
    expect(slugs).toContain('jane-def')
  })
})

// ─── listByRole: location filter ─────────────────────────────────────────────

describe('listByRole location filter', () => {
  it('filters by placeName (case-insensitive)', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', ['en'], true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', ['en'], false)
    })

    const result = await t.query(api.directory.listByRole, { role: 'Instructor', placeName: 'phuket' })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('john-abc')
  })

  it('filters by country', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      const u3 = await seedInstructorUser(ctx, 'bali-guide')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', ['en'], true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', ['en'], false)
      await seedInstructorProfile(ctx, u3, 'Bali Guide', 'Denpasar', 'Indonesia', ['id', 'en'], true)
    })

    const result = await t.query(api.directory.listByRole, { role: 'Instructor', country: 'Thailand' })
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.country === 'Thailand')).toBe(true)
  })

  it('filters by both placeName and country', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      const u3 = await seedInstructorUser(ctx, 'tom-ghi')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', ['en'], true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', ['en'], false)
      await seedInstructorProfile(ctx, u3, 'Tom Müller', 'Phuket', 'Thailand', ['de', 'en'], true)
    })

    const result = await t.query(api.directory.listByRole, { role: 'Instructor', placeName: 'Krabi', country: 'Thailand' })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('jane-def')
  })

  it('returns empty when no match for placeName', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', ['en'], true)
    })

    const result = await t.query(api.directory.listByRole, { role: 'Instructor', placeName: 'Bangkok' })
    expect(result).toHaveLength(0)
  })
})

// ─── listByRole: language filter ─────────────────────────────────────────────

describe('listByRole language filter', () => {
  it('filters by language (case-insensitive)', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      const u3 = await seedInstructorUser(ctx, 'tom-ghi')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', ['en', 'th'], true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', ['en', 'zh'], false)
      await seedInstructorProfile(ctx, u3, 'Tom Müller', 'Phuket', 'Thailand', ['de', 'en'], true)
    })

    // All three speak 'en'
    const result = await t.query(api.directory.listByRole, { role: 'Instructor', language: 'EN' })
    expect(result).toHaveLength(3)
  })

  it('returns only stakeholders that speak German', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      const u3 = await seedInstructorUser(ctx, 'tom-ghi')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', ['en', 'th'], true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', ['en', 'zh'], false)
      await seedInstructorProfile(ctx, u3, 'Tom Müller', 'Phuket', 'Thailand', ['de', 'en'], true)
    })

    const result = await t.query(api.directory.listByRole, { role: 'Instructor', language: 'de' })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('tom-ghi')
  })

  it('returns empty when no stakeholder speaks the requested language', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const u1 = await seedInstructorUser(ctx, 'john-abc')
      const u2 = await seedInstructorUser(ctx, 'jane-def')
      await seedInstructorProfile(ctx, u1, 'John Smith', 'Phuket', 'Thailand', ['en'], true)
      await seedInstructorProfile(ctx, u2, 'Jane Lee', 'Krabi', 'Thailand', ['en', 'zh'], false)
    })

    const result = await t.query(api.directory.listByRole, { role: 'Instructor', language: 'ja' })
    expect(result).toHaveLength(0)
  })
})
