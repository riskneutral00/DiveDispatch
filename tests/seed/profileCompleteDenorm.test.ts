import { describe, it, expect } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { checkProfileCompleteness } from '../../convex/lib/profileCompleteness'
import { makeT } from '../helpers/convex-helpers'

describe('seed denorm + sea-fun autofilled prefs', () => {
  it('sea-fun has a stakeholderPreferences row populated from self-owned resources after seedAll', async () => {
    const t = makeT()
    await t.action(internal.seed.seedAll, {})

    const prefs = await t.run(async (ctx) =>
      ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', 'sea-fun'))
        .collect(),
    )
    expect(prefs).toHaveLength(1)
    const row = prefs[0]
    expect((row.preferredVenueSlugs ?? []).length).toBeGreaterThan(0)
    expect((row.preferredBoatSlugs ?? []).length).toBeGreaterThan(0)
    expect((row.preferredEquipmentSlugs ?? []).length).toBeGreaterThan(0)
    expect((row.preferredCompressorSlugs ?? []).length).toBeGreaterThan(0)
    expect(row.preferredInstructorSlugs).toEqual(['sea-fun'])
  })

  it('every userRoles row denorm matches live checkProfileCompleteness result (no drift)', async () => {
    const t = makeT()
    await t.action(internal.seed.seedAll, {})

    const drifted = await t.run(async (ctx) => {
      const rows = await ctx.db.query('userRoles').collect()
      const out: { userSlug: string; role: string; denorm: boolean; live: boolean }[] = []
      for (const row of rows) {
        const user = await ctx.db.get(row.userId)
        if (!user) continue
        const { percentage } = await checkProfileCompleteness(ctx, { _id: row.userId }, row.role)
        const live = percentage === 100
        const denorm = row.profileComplete ?? false
        if (denorm !== live) out.push({ userSlug: user.slug, role: row.role, denorm, live })
      }
      return out
    })

    expect(
      drifted,
      `denorm/live mismatch: ${drifted.map((d) => `${d.userSlug}/${d.role}: denorm=${d.denorm} live=${d.live}`).join(' | ')}`,
    ).toEqual([])
  })
})
