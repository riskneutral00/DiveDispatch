import { describe, it, expect } from 'vitest'
import { internal } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'
import { SEED_THEME_SPECS, RETIRED_THEME_SLUGS } from '../convex/lib/defaultThemes'
import type { SeedCtx } from './fixtures'

describe('themes.ensureSystemThemes', () => {
  it('inserts the full SEED_THEME_SPECS catalog when themes table is empty', async () => {
    const t = makeT()
    const result = await t.mutation(internal.themes.ensureSystemThemes, {})
    expect(result).toEqual({ upserted: SEED_THEME_SPECS.length })

    const rows = await t.run(async (ctx: SeedCtx) => ctx.db.query('themes').collect())
    expect(rows.length).toBe(SEED_THEME_SPECS.length)
    for (const spec of SEED_THEME_SPECS) {
      const row = rows.find((r) => r.slug === spec.slug)
      expect(row).toBeDefined()
      expect(row?.isActive).toBe(true)
      expect(row?.appearance).toBe(spec.appearance)
      expect(row?.tier).toBe('free')
      expect(row?.sortOrder).toBe(spec.sortOrder)
    }
  })

  it('is idempotent when called twice without force', async () => {
    const t = makeT()
    await t.mutation(internal.themes.ensureSystemThemes, {})
    const second = await t.mutation(internal.themes.ensureSystemThemes, {})
    expect(second).toEqual({ skipped: true })

    const rows = await t.run(async (ctx: SeedCtx) => ctx.db.query('themes').collect())
    expect(rows.length).toBe(SEED_THEME_SPECS.length)
  })

  it('re-upserts and deletes retired slugs when force=true', async () => {
    const t = makeT()

    await t.run(async (ctx: SeedCtx) => {
      await ctx.db.insert('themes', {
        slug: RETIRED_THEME_SLUGS[0],
        name: 'Legacy Retired Theme',
        config: JSON.stringify({}),
        isActive: true,
        appearance: 'dark',
        createdAt: Date.now(),
      })
    })

    await t.mutation(internal.themes.ensureSystemThemes, { force: true })

    const rows = await t.run(async (ctx: SeedCtx) => ctx.db.query('themes').collect())
    const slugs = rows.map((r) => r.slug)
    for (const spec of SEED_THEME_SPECS) {
      expect(slugs).toContain(spec.slug)
    }
    for (const retired of RETIRED_THEME_SLUGS) {
      expect(slugs).not.toContain(retired)
    }
  })

  it('overwrites an existing row with current SEED_THEME_SPECS values on force', async () => {
    const t = makeT()

    await t.run(async (ctx: SeedCtx) => {
      await ctx.db.insert('themes', {
        slug: SEED_THEME_SPECS[0].slug,
        name: 'Stale Name',
        config: JSON.stringify({ stale: true }),
        isActive: false,
        appearance: SEED_THEME_SPECS[0].appearance,
        createdAt: Date.now(),
      })
    })

    await t.mutation(internal.themes.ensureSystemThemes, { force: true })

    const row = await t.run(async (ctx: SeedCtx) =>
      ctx.db
        .query('themes')
        .withIndex('by_slug', (q) => q.eq('slug', SEED_THEME_SPECS[0].slug))
        .unique(),
    )
    expect(row?.name).toBe(SEED_THEME_SPECS[0].name)
    expect(row?.isActive).toBe(true)
  })
})
