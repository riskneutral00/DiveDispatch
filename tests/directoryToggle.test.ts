/**
 * Directory Toggle — Integration Tests
 *
 * Tests togglePreferredInstructor mutation.
 * Modifies preferredInstructorSlugs in stakeholderPreferences,
 * which feeds the booking coverage gate.
 */

import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { seedUser, TEST_TOKENS, TEST_SLUGS } from './fixtures/seedFixture'

const modules = import.meta.glob('../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

/** Seed prefs row (onboarding always creates this before toggle is used) */
async function seedPrefs(ctx: Ctx, slug: string, existingInstructors: string[] = []) {
  await ctx.db.insert('stakeholderPreferences', {
    stakeholderId: slug,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stakeholderType: 'DiveCenter' as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    acceptanceMode: 'Auto' as any,
    maxHoursPerDay: 8,
    postJobBlockDuration: 0,
    useNamedUnits: false,
    commonLanguageCodes: ['en'],
    confirmOnAccept: true,
    confirmOnDecline: true,
    preferredInstructorSlugs: existingInstructors,
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('togglePreferredInstructor', () => {
  it('rejects unauthenticated caller', async () => {
    const t = makeT()
    await expect(
      t.mutation(api.directory.togglePreferredInstructor, { instructorSlug: 'any' }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('adds instructor slug and returns starred: true', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx)
      await seedPrefs(ctx, TEST_SLUGS.diveCenter)
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.directory.togglePreferredInstructor, { instructorSlug: 'instr-1' })

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
      await seedPrefs(ctx, TEST_SLUGS.diveCenter, ['instr-1'])
    })

    const result = await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.directory.togglePreferredInstructor, { instructorSlug: 'instr-1' })

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
      await seedPrefs(ctx, TEST_SLUGS.diveCenter, ['instr-1'])
    })

    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter })
      .mutation(api.directory.togglePreferredInstructor, { instructorSlug: 'instr-2' })

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
      .mutation(api.directory.togglePreferredInstructor, { instructorSlug: 'instr-new' })

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
