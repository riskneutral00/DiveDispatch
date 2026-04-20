import { query } from './_generated/server'
import { v, ConvexError } from 'convex/values'
import { ROLE_TABLE_MAP } from './lib/profileHelpers'
import { requireDevEnvironment } from './lib/devGuard'
import { ErrorCode } from './lib/errorCodes'
import { queryDynamicTable } from './lib/typedDb'
import { getAllUserRoles } from './lib/userRoleHelpers'

const VENUE_CATEGORY_BY_ROLE: Record<string, 'pool' | 'diveSite'> = {
  Pool: 'pool',
  DiveSite: 'diveSite',
}

export const captureBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    requireDevEnvironment()

    const user = await ctx.db
      .query('users')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()
    if (!user) {
      throw new ConvexError({
        code: ErrorCode.NOT_FOUND,
        reason: `No user with slug '${slug}'`,
      })
    }

    const userRoles = await getAllUserRoles(ctx, user._id)

    const organization = await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique()

    const profiles: Record<string, unknown> = {}
    if (organization) {
      for (const r of userRoles) {
        const table = ROLE_TABLE_MAP[r.role]
        if (!table) continue

        if (table === 'venues') {
          const category = VENUE_CATEGORY_BY_ROLE[r.role]
          if (!category) continue
          const venues = await ctx.db
            .query('venues')
            .withIndex('by_organizationId', (q) => q.eq('organizationId', organization._id))
            .collect() // bounded: single org owns at most a handful of venues (pool + diveSite cap)
          const match = venues.find((v) => v.venueCategory === category)
          if (match) profiles[r.role] = match
          continue
        }

        const profile = await queryDynamicTable(ctx.db, table)
          .withIndex('by_organizationId', (q) => q.eq('organizationId', organization._id))
          .unique()
        if (profile) profiles[r.role] = profile
      }
    }

    return {
      user,
      roles: userRoles.map((r) => ({ role: r.role })),
      organization,
      profiles,
    }
  },
})
