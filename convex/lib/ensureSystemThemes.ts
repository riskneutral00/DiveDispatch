import type { MutationCtx } from '../_generated/server'
import { RETIRED_THEME_SLUGS, SEED_THEME_SPECS, themeConfigForSeedSpec } from './defaultThemes'

export async function ensureSystemThemesInline(
  ctx: MutationCtx,
  opts: { force?: boolean } = {},
): Promise<{ skipped: true } | { upserted: number }> {
  if (!opts.force) {
    const hasAny = await ctx.db.query('themes').first()
    if (hasAny) return { skipped: true }
  }

  for (const spec of SEED_THEME_SPECS) {
    const config = themeConfigForSeedSpec(spec)
    const existing = await ctx.db
      .query('themes')
      .withIndex('by_slug', (q) => q.eq('slug', spec.slug))
      .unique() // batch-exempt: bounded to SEED_THEME_SPECS length (~8)
    const row = {
      name: spec.name,
      slug: spec.slug,
      config: JSON.stringify(config),
      isActive: true,
      appearance: spec.appearance,
      tier: 'free' as const,
      sortOrder: spec.sortOrder,
    }
    if (existing) {
      await ctx.db.patch(existing._id, row) // batch-exempt: bounded
    } else {
      await ctx.db.insert('themes', { ...row, createdAt: Date.now() }) // batch-exempt: bounded
    }
  }

  for (const slug of RETIRED_THEME_SLUGS) {
    const legacy = await ctx.db
      .query('themes')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique() // batch-exempt: bounded to RETIRED_THEME_SLUGS length
    if (legacy) await ctx.db.delete(legacy._id) // batch-exempt: bounded
  }

  return { upserted: SEED_THEME_SPECS.length }
}
