import { describe, it, expect } from 'vitest'
import { internal } from '../../convex/_generated/api'
import { checkProfileCompleteness } from '../../convex/lib/profileCompleteness'
import { makeT } from '../helpers/convex-helpers'

describe('seed denorm + sea-fun no-prefs', () => {
  it('sea-fun has zero stakeholderPreferences rows after seedAll', async () => {
    const t = makeT()
    await t.action(internal.seed.seedAll, {})

    const prefs = await t.run(async (ctx) =>
      ctx.db
        .query('stakeholderPreferences')
        .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', 'sea-fun'))
        .collect(),
    )
    expect(prefs).toHaveLength(0)
  })

  it('sea-fun DC + Venue userRoles.profileComplete = false; Equipment/Boat/Instructor/Compressor = true', async () => {
    const t = makeT()
    await t.action(internal.seed.seedAll, {})

    const denorms = await t.run(async (ctx) => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_slug', (q) => q.eq('slug', 'sea-fun'))
        .unique()
      expect(user, 'sea-fun seed user must exist').toBeTruthy()
      const rows = await ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', user!._id))
        .collect()
      return rows.map((r) => ({ role: r.role, complete: r.profileComplete ?? false }))
    })

    const byRole = Object.fromEntries(denorms.map((d) => [d.role, d.complete]))
    expect(byRole.DiveCenter).toBe(false)
    expect(byRole.Venue).toBe(false)
    expect(byRole.Equipment).toBe(true)
    expect(byRole.Boat).toBe(true)
    expect(byRole.Instructor).toBe(true)
    expect(byRole.Compressor).toBe(true)
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
