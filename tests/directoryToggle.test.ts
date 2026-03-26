/**
 * Directory Toggle — Integration Tests
 *
 * Tests togglePreferredInstructor mutation.
 * Modifies preferredInstructorSlugs in stakeholderPreferences,
 * which feeds the booking coverage gate.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { seedUser, seedStakeholderPreferences, TEST_TOKENS, TEST_SLUGS } from './fixtures'
import { makeT } from './helpers/convex-helpers'


// ─── Tests ────────────────────────────────────────────────────────────────────

describe('togglePreferredInstructor', () => {
  it('rejects unauthenticated caller', async () => {
    const t = makeT()
    await expect(
      t.mutation(api.directory.togglePreferredInstructor, { activeRole: 'DiveCenter', instructorSlug: 'any' }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('adds instructor slug and returns starred: true', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
      await seedStakeholderPreferences(ctx, TEST_SLUGS.diveCenter)
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.directory.togglePreferredInstructor, { activeRole: 'DiveCenter', instructorSlug: 'instr-1' })

    expect(result.starred).toBe(true)

    // Verify persistence
    await t.run(async (ctx) => {
      const prefs = await ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', TEST_SLUGS.diveCenter))
        .unique()
      expect(prefs!.preferredInstructorSlugs).toContain('instr-1')
    })
  })

  it('removes instructor slug on second call (toggle off)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
      await seedStakeholderPreferences(ctx, TEST_SLUGS.diveCenter, { preferredInstructorSlugs: ['instr-1'] })
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.directory.togglePreferredInstructor, { activeRole: 'DiveCenter', instructorSlug: 'instr-1' })

    expect(result.starred).toBe(false)

    await t.run(async (ctx) => {
      const prefs = await ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', TEST_SLUGS.diveCenter))
        .unique()
      expect(prefs!.preferredInstructorSlugs).not.toContain('instr-1')
    })
  })

  it('adding second instructor does not remove first', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
      await seedStakeholderPreferences(ctx, TEST_SLUGS.diveCenter, { preferredInstructorSlugs: ['instr-1'] })
    })

    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.directory.togglePreferredInstructor, { activeRole: 'DiveCenter', instructorSlug: 'instr-2' })

    await t.run(async (ctx) => {
      const prefs = await ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', TEST_SLUGS.diveCenter))
        .unique()
      expect(prefs!.preferredInstructorSlugs).toContain('instr-1')
      expect(prefs!.preferredInstructorSlugs).toContain('instr-2')
    })
  })

  it('creates prefs row with instructor if none exists (fallback)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
      // No prefs row seeded — tests the code path even though onboarding should create it
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.directory.togglePreferredInstructor, { activeRole: 'DiveCenter', instructorSlug: 'instr-new' })

    expect(result.starred).toBe(true)

    await t.run(async (ctx) => {
      const prefs = await ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', TEST_SLUGS.diveCenter))
        .unique()
      expect(prefs).toBeTruthy()
      expect(prefs!.preferredInstructorSlugs).toContain('instr-new')
    })
  })
})
