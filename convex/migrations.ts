import { internalMutation } from './_generated/server'

export const backfillVenueSlugs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const venues = await ctx.db.query('venues').collect() // bounded: one-off migration, venues table small
    const existingSlugs = new Set<string>(
      venues.map((v) => v.slug).filter((s): s is string => Boolean(s)),
    )
    let patched = 0
    for (const venue of venues) {
      if (venue.slug) continue
      const base = venue.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'venue'
      let candidate = base
      let suffix = 1
      while (existingSlugs.has(candidate)) {
        suffix += 1
        candidate = `${base}-${suffix}`
      }
      existingSlugs.add(candidate)

      await ctx.db.patch(venue._id, { slug: candidate })

      const unit = await ctx.db
        .query('inventoryUnits')
        .withIndex('by_ownerId_ownerType', (q) =>
          q.eq('ownerId', venue.organizationId ? String(venue._id) : '__unowned__').eq('ownerType', 'Venue'),
        )
        .unique()
      if (!unit) {
        const fallbackUnit = await ctx.db
          .query('inventoryUnits')
          .filter((q) =>
            q.and(
              q.eq(q.field('ownerType'), 'Venue'),
              q.eq(q.field('displayName'), venue.name),
            ),
          )
          .first() // bounded: per-name lookup, single row expected
        if (fallbackUnit) {
          await ctx.db.patch(fallbackUnit._id, { ownerId: candidate, resourceId: candidate })
        }
      }
      patched += 1
    }
    return { total: venues.length, patched }
  },
})
