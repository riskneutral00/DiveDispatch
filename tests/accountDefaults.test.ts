import { describe, it, expect, beforeEach } from 'vitest'
import { api } from '../convex/_generated/api'
import {
  TEST_TOKENS,
  TEST_SLUGS,
  seedUser,
  seedDiveCenterProfile,
  seedInstructorProfile,
  seedBookingTemplate,
  seedStakeholderPreferences,
} from './fixtures'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import { checkProfileCompleteness } from '../convex/lib/profileCompleteness'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── updateAccountDefaults mutation ─────────────────────────────────────────

describe('updateAccountDefaults mutation', () => {
  it('persists defaultLocation, defaultContactEmail, defaultContactPhone', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.users.updateAccountDefaults, {
        defaultLocation: 'Koh Tao, Thailand',
        defaultContactEmail: 'default@dive.com',
        defaultContactPhone: '+66999999999',
      })

    const user = await t.run(async (ctx) =>
      ctx.db
        .query('users')
        .withIndex('by_slug', (q: any) => q.eq('slug', TEST_SLUGS.diveCenter))
        .unique(),
    )

    expect(user?.defaultLocation).toBe('Koh Tao, Thailand')
    expect(user?.defaultContactEmail).toBe('default@dive.com')
    expect(user?.defaultContactPhone).toBe('+66999999999')
  })

  it('allows partial updates', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.users.updateAccountDefaults, {
        defaultContactEmail: 'only-email@dive.com',
      })

    const user = await t.run(async (ctx) =>
      ctx.db
        .query('users')
        .withIndex('by_slug', (q: any) => q.eq('slug', TEST_SLUGS.diveCenter))
        .unique(),
    )

    expect(user?.defaultContactEmail).toBe('only-email@dive.com')
    expect(user?.defaultLocation).toBeUndefined()
    expect(user?.defaultContactPhone).toBeUndefined()
  })

  it('rejects unauthenticated caller', async () => {
    await expectConvexError(
      t.mutation(api.users.updateAccountDefaults, {
        defaultContactEmail: 'nope@dive.com',
      }),
      'UNAUTHENTICATED',
    )
  })
})

// ─── getAccountDefaults query ───────────────────────────────────────────────

describe('getAccountDefaults query', () => {
  it('returns stored defaults', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.users.updateAccountDefaults, {
        defaultLocation: 'Koh Tao, Thailand',
        defaultContactEmail: 'default@dive.com',
        defaultContactPhone: '+66999999999',
      })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.users.getAccountDefaults, {})

    expect(result).toEqual({
      defaultLocation: 'Koh Tao, Thailand',
      defaultContactEmail: 'default@dive.com',
      defaultContactPhone: '+66999999999',
      customerLanguages: undefined,
    })
  })

  it('returns undefined fields when no defaults set', async () => {
    await t.run(async (ctx) => {
      await seedUser(ctx)
    })

    const result = await t
      .withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .query(api.users.getAccountDefaults, {})

    expect(result).toEqual({
      defaultLocation: undefined,
      defaultContactEmail: undefined,
      defaultContactPhone: undefined,
      customerLanguages: undefined,
    })
  })

  it('returns null for unauthenticated caller', async () => {
    const result = await t.query(api.users.getAccountDefaults, {})
    expect(result).toBeNull()
  })
})

// ─── profileCompleteness with account defaults fallback ─────────────────────

describe('profileCompleteness with account defaults', () => {
  it('role profile with empty contactEmail uses user defaultContactEmail for completeness', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })

      // Set account defaults on user
      await ctx.db.patch(userId, {
        defaultContactEmail: 'fallback@dive.com',
        defaultContactPhone: '+66111111111',
      })

      // Seed instructor profile with empty contact fields
      await seedInstructorProfile(ctx, userId, {
        contactEmail: '',
        contactPhone: '',
      })

      const user = await ctx.db.get(userId)
      const result = await checkProfileCompleteness(ctx, user!)

      // contactEmail and contactPhone should be considered filled via defaults
      expect(result.incomplete).not.toContain('Contact email')
      expect(result.incomplete).not.toContain('Contact phone')
    })
  })

  it('role profile with filled fields ignores defaults', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })

      await ctx.db.patch(userId, {
        defaultContactEmail: 'fallback@dive.com',
        defaultContactPhone: '+66111111111',
      })

      // Seed instructor profile with filled contact fields
      await seedInstructorProfile(ctx, userId)

      const user = await ctx.db.get(userId)
      const result = await checkProfileCompleteness(ctx, user!)

      expect(result.incomplete).not.toContain('Contact email')
      expect(result.incomplete).not.toContain('Contact phone')
      expect(result.percentage).toBe(100)
    })
  })

  it('no defaults and no profile contact fields still marks incomplete', async () => {
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.instructor,
        slug: TEST_SLUGS.instructor,
        role: 'Instructor',
      })

      // No defaults set on user, profile has empty contacts
      await seedInstructorProfile(ctx, userId, {
        contactEmail: '',
        contactPhone: '',
      })

      const user = await ctx.db.get(userId)
      const result = await checkProfileCompleteness(ctx, user!)

      expect(result.incomplete).toContain('Contact email')
      expect(result.incomplete).toContain('Contact phone')
    })
  })
})
