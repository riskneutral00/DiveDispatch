import { v } from 'convex/values'
import { query } from '../_generated/server'
import { requireDevEnvironment } from '../lib/devGuard'
import { evaluateRowCompleteness } from '../lib/completeness/perRow'

export const run = query({
  args: { venueSlug: v.string(), userSlug: v.string() },
  handler: async (ctx, { venueSlug, userSlug }) => {
    requireDevEnvironment()
    const venue = await ctx.db
      .query('venues')
      .withIndex('by_slug', (q) => q.eq('slug', venueSlug))
      .unique()
    const user = await ctx.db
      .query('users')
      .withIndex('by_slug', (q) => q.eq('slug', userSlug))
      .unique()
    if (!venue || !user) return { error: 'missing', venueFound: !!venue, userFound: !!user }
    const result = await evaluateRowCompleteness(
      ctx,
      user,
      'Venue',
      venue as unknown as Record<string, unknown>,
      user.organizationId ?? null,
    )
    return {
      venueSlug,
      userSlug,
      venueOrg: venue.organizationId,
      userOrg: user.organizationId,
      complete: result.complete,
      incomplete: result.incomplete,
      profileRowSnapshot: {
        name: venue.name,
        kind: venue.kind,
        email: venue.email ?? null,
        phone: venue.phone ?? null,
        addressCity: venue.address?.city ?? null,
        addressCountry: venue.address?.country ?? null,
        maxDepth: venue.maxDepth ?? null,
        maxCapacity: venue.maxCapacity ?? null,
        confinedCapable: venue.confinedCapable ?? null,
      },
    }
  },
})
