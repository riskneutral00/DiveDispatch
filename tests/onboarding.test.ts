import { describe, it, expect, vi } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUser, seedDiveCenterProfile, seedStakeholderPreferences, findProfileByUser, getOrCreateTestOrg } from './fixtures'
import { makeT } from './helpers/convex-helpers'
import { createUserDefaults } from './helpers/createUser'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('onboarding schema', () => {
  it('new user created via createUser exists', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t.withIdentity({ tokenIdentifier: 'clerk|new-dc', email: 'new-dc@test.com' })
      .mutation(api.users.createUser, { ...createUserDefaults, role: 'DiveCenter' })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user).toBeTruthy()
  })
})

describe('getOnboardingStatus', () => {
  it('returns 0% when user has no profile', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-noprofile', tokenIdentifier: 'clerk|dc-noprofile', role: 'DiveCenter' }))

    const status = await t.withIdentity({ tokenIdentifier: 'clerk|dc-noprofile' })
      .query(api.users.getOnboardingStatus, {})

    // No DiveCenter profile, no phone, no appLanguage -> many fields missing
    expect(status.percentage).toBeLessThan(50)
    expect(status.incomplete.length).toBeGreaterThan(0)
  })

  it('returns less than 100% when missing some fields', async () => {
    const t = makeT()
    const userId = await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-partial', tokenIdentifier: 'clerk|dc-partial', role: 'DiveCenter' }))

    // Insert profile with name, placeName, country filled but no customerLanguages
    await t.run(async (ctx) => {
      await seedDiveCenterProfile(ctx, userId, {
        email: '',
        phone: '',
        associations: [],
      })
    })

    const status = await t.withIdentity({ tokenIdentifier: 'clerk|dc-partial' })
      .query(api.users.getOnboardingStatus, {})

    // Missing: phone (user), appLanguage (user), associations (role), customerLanguages (role)
    expect(status.percentage).toBeLessThan(100)
    expect(status.incomplete.length).toBeGreaterThan(0)
  })

  it('returns 100% when all profile, settings, and role fields are filled', async () => {
    const t = makeT()
    const userId = await t.run(async (ctx) => {
      const uid = await seedUser(ctx, { slug: 'dc-complete', tokenIdentifier: 'clerk|dc-complete', role: 'DiveCenter' })
      // Set profile + settings layer fields
      await ctx.db.patch(uid, { phone: '+66123456789', appLanguage: 'en' })
      await seedDiveCenterProfile(ctx, uid)
      // Set customerLanguages
      const dc = await findProfileByUser(ctx, uid, 'diveCenters')
      if (dc) await ctx.db.patch(dc._id, { customerLanguages: ['en'] })
      // Seed preferences — layers 4 (acceptanceMode) and 5 (coverage) for operator roles
      await seedStakeholderPreferences(ctx, 'dc-complete', {
        stakeholderType: 'DiveCenter',
        preferredInstructorSlugs: ['any-instr'],
        preferredEquipmentSlugs: ['any-equip'],
        preferredBoatSlugs: ['any-boat'],
        preferredCompressorSlugs: ['any-comp'],
      })
      return uid
    })

    const status = await t.withIdentity({ tokenIdentifier: 'clerk|dc-complete' })
      .query(api.users.getOnboardingStatus, {})

    expect(status.percentage).toBe(100)
    expect(status.incomplete).toHaveLength(0)
  })

  it('uses the weakest role completeness for mixed-role users', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, { slug: 'mixed-weakest', tokenIdentifier: 'clerk|mixed-weakest', role: 'DiveCenter' })
      const organizationId = await getOrCreateTestOrg(ctx, userId)
      await ctx.db.patch(userId, { phone: '+66123456789', appLanguage: 'en' })
      await seedDiveCenterProfile(ctx, userId)
      await ctx.db.insert('userRoles', {
        userId,
        role: 'Instructor',
        organizationId,
        createdAt: Date.now(),
      })
    })

    const onboarding = await t.withIdentity({ tokenIdentifier: 'clerk|mixed-weakest' })
      .query(api.users.getOnboardingStatus, {})
    const weakest = await t.withIdentity({ tokenIdentifier: 'clerk|mixed-weakest' })
      .query(api.users.getLowestProfileCompletion, {})

    expect(onboarding.percentage).toBe(weakest.percentage)
  })
})


describe('Quick Book pills (bookingTemplates)', () => {
  it('creates bookingTemplate entries from preferences step', async () => {
    const t = makeT()
    await t.run(async (ctx) => seedUser(ctx, { slug: 'dc-pills', tokenIdentifier: 'clerk|dc-pills', role: 'DiveCenter', name: 'Pills DC' }))

    // Create two Quick Book pills
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-pills' })
      .mutation(api.bookingTemplates.create, { activeRole: 'DiveCenter', name: 'DSD', activityType: ['DSD'] })
    await t.withIdentity({ tokenIdentifier: 'clerk|dc-pills' })
      .mutation(api.bookingTemplates.create, { activeRole: 'DiveCenter', name: 'OW', activityType: ['OW'] })

    const templates = await t.withIdentity({ tokenIdentifier: 'clerk|dc-pills' })
      .query(api.bookingTemplates.list, { activeRole: 'DiveCenter' })

    expect(templates).toHaveLength(2)
    const names = templates.map((t: { name: string }) => t.name)
    expect(names).toContain('DSD')
    expect(names).toContain('OW')
  })
})
