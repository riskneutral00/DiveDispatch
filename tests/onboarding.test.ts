import { describe, it, expect, vi } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUser, type SeedCtx } from './fixtures'
import { makeT } from './helpers/convex-helpers'

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedDiveCenterProfile(
  ctx: SeedCtx,
  userId: Awaited<ReturnType<SeedCtx['db']['insert']>>,
  overrides: Record<string, unknown> = {},
) {
  return ctx.db.insert('diveCenters', {
    userId,
    name: 'Test Dive Center',
    placeName: 'Koh Tao',
    country: 'Thailand',
    lat: 10.0957,
    lng: 99.8408,
    contactEmail: 'info@testdc.com',
    contactPhone: '+66123456789',
    associations: [{ agency: 'PADI', number: '12345' }],
    verified: false,
    ...overrides,
  } as Parameters<typeof ctx.db.insert<'diveCenters'>>[1])
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('onboarding schema', () => {
  it('new user created via createUser has onboardingComplete undefined', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t.withIdentity({ tokenIdentifier: 'clerk|new-dc' })
      .mutation(api.users.createUser, { role: 'DiveCenter', businessName: 'Test DC' })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.onboardingComplete).toBeUndefined()
  })
})

describe('getOnboardingStatus', () => {
  it('returns 0% when user has no profile', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-noprofile', tokenIdentifier: 'clerk|dc-noprofile', role: 'DiveCenter' }))

    const status = await t.withIdentity({ tokenIdentifier: 'clerk|dc-noprofile' })
      .query(api.users.getOnboardingStatus, {})

    expect(status.percentage).toBe(0)
    expect(status.incomplete.length).toBeGreaterThan(0)
  })

  it('returns ~38% when DiveCenter user has 3 of 8 fields filled', async () => {
    const t = makeT()
    const userId = await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-partial', tokenIdentifier: 'clerk|dc-partial', role: 'DiveCenter' }))

    // Insert profile with only name, placeName, country filled (3 of 9)
    await t.run(async (ctx) =>
      seedDiveCenterProfile(ctx, userId, {
        name: 'Partial DC',
        placeName: 'Koh Tao',
        country: 'Thailand',
        lat: 10.0957,
        lng: 99.8408,
        contactEmail: '',       // missing
        contactPhone: '',       // missing
        associations: [],       // missing
      }),
    )
    // No bookingTemplate — missing Quick Book pill
    // No stakeholderPreferences — missing Preferred instructors

    const status = await t.withIdentity({ tokenIdentifier: 'clerk|dc-partial' })
      .query(api.users.getOnboardingStatus, {})

    // 3 of 8 filled → Math.round(3/8 * 100) = Math.round(37.5) = 38
    expect(status.percentage).toBe(38)
    expect(status.incomplete).toContain('Contact email')
    expect(status.incomplete).toContain('Contact phone')
    expect(status.incomplete).toContain('Agency associations')
    expect(status.incomplete).toContain('Quick Book pill')
    expect(status.incomplete).toContain('Preferred instructors')
  })

  it('returns 100% when all fields filled, template exists, and preferred instructors set', async () => {
    const t = makeT()
    const userId = await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-complete', tokenIdentifier: 'clerk|dc-complete', role: 'DiveCenter' }))

    await t.run(async (ctx) => seedDiveCenterProfile(ctx, userId))

    // Create a bookingTemplate
    await t.run(async (ctx) =>
      ctx.db.insert('bookingTemplates', {
        ownerId: 'dc-complete',
        ownerType: 'DiveCenter',
        name: 'OW Quick Book',
        activityType: ['OW'],
        createdAt: Date.now(),
      }),
    )

    // Create preferred instructors — stakeholderId must be the slug string
    await t.run(async (ctx) => {
      await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: 'dc-complete',
        stakeholderType: 'DiveCenter',
        acceptanceMode: 'Auto',
        maxHoursPerDay: 8,
        postJobBlockDuration: 0,
        useNamedUnits: false,
        commonLanguageCodes: [],
        preferredInstructorSlugs: ['inst-1'],
        confirmOnAccept: false,
        confirmOnDecline: false,
      })
    })

    const status = await t.withIdentity({ tokenIdentifier: 'clerk|dc-complete' })
      .query(api.users.getOnboardingStatus, {})

    expect(status.percentage).toBe(100)
    expect(status.incomplete).toHaveLength(0)
  })
})

describe('completeOnboarding', () => {
  it('sets onboardingComplete = true on the user record', async () => {
    const t = makeT()
    const userId = await t.run(async (ctx) =>
      seedUser(ctx, { slug: 'dc-ready', tokenIdentifier: 'clerk|dc-ready', role: 'DiveCenter', name: 'Ready DC' }),
    )

    await t.withIdentity({ tokenIdentifier: 'clerk|dc-ready' })
      .mutation(api.users.completeOnboarding, {})

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.onboardingComplete).toBe(true)
  })

  it('throws UNAUTHENTICATED when no identity', async () => {
    const t = makeT()
    await expect(
      t.mutation(api.users.completeOnboarding, {}),
    ).rejects.toMatchObject({ data: expect.stringContaining('UNAUTHENTICATED') })
  })

  it('throws VALIDATION when user name is blank', async () => {
    const t = makeT()
    await t.run(async (ctx) =>
      seedUser(ctx, { slug: 'dc-noname', tokenIdentifier: 'clerk|dc-noname', role: 'DiveCenter', name: '' }),
    )

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-noname' })
        .mutation(api.users.completeOnboarding, {}),
    ).rejects.toMatchObject({ data: expect.stringContaining('VALIDATION') })
  })
})

describe('Quick Book pills (bookingTemplates)', () => {
  it('creates bookingTemplate entries from preferences step', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-pills', tokenIdentifier: 'clerk|dc-pills', role: 'DiveCenter', name: 'Pills DC' }))

    // Create two Quick Book pills
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-pills' })
      .mutation(api.bookingTemplates.create, { name: 'DSD', activityType: ['DSD'] })
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-pills' })
      .mutation(api.bookingTemplates.create, { name: 'OW', activityType: ['OW'] })

    const templates = await t.withIdentity({ tokenIdentifier: 'clerk|dc-pills' })
      .query(api.bookingTemplates.list, {})

    expect(templates).toHaveLength(2)
    const names = templates.map((t: { name: string }) => t.name)
    expect(names).toContain('DSD')
    expect(names).toContain('OW')
  })

  it('getOnboardingStatus sees Quick Book pill as complete after template created', async () => {
    const t = makeT()
    const userId = await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-pill-check', tokenIdentifier: 'clerk|dc-pill-check', role: 'DiveCenter' }))

    await t.run(async (ctx) => seedDiveCenterProfile(ctx, userId))

    // Seed preferred instructors so only Quick Book pill is missing
    // stakeholderId must be the slug string, not user._id
    await t.run(async (ctx) => {
      await ctx.db.insert('stakeholderPreferences', {
        stakeholderId: 'dc-pill-check',
        stakeholderType: 'DiveCenter',
        acceptanceMode: 'Auto',
        maxHoursPerDay: 8,
        postJobBlockDuration: 0,
        useNamedUnits: false,
        commonLanguageCodes: [],
        preferredInstructorSlugs: ['inst-1'],
        confirmOnAccept: false,
        confirmOnDecline: false,
      })
    })

    // No template yet → Quick Book pill incomplete
    const before = await t.withIdentity({ tokenIdentifier: 'clerk|dc-pill-check' })
      .query(api.users.getOnboardingStatus, {})
    expect(before.incomplete).toContain('Quick Book pill')

    // Add template
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-pill-check' })
      .mutation(api.bookingTemplates.create, { name: 'FD', activityType: ['FD'] })

    const after = await t.withIdentity({ tokenIdentifier: 'clerk|dc-pill-check' })
      .query(api.users.getOnboardingStatus, {})
    expect(after.incomplete).not.toContain('Quick Book pill')
    expect(after.percentage).toBe(100)
  })
})
