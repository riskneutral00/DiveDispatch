import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getAuthUser } from './lib/auth'

const courseCode = v.union(
  v.literal('DSD'),
  v.literal('TRY_DIVE'),
  v.literal('OW'),
  v.literal('AOW'),
  v.literal('RESCUE'),
  v.literal('DM'),
  v.literal('FD'),
  v.literal('REFRESH'),
  v.literal('SPECIALTY'),
)

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return []

    return ctx.db
      .query('bookingTemplates')
      .withIndex('by_ownerId_ownerType', (q) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        q.eq('ownerId', user.slug).eq('ownerType', user.role as any),
      )
      .collect()
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    activityType: v.array(courseCode),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx)
    if (!user) throw new ConvexError({ code: 'UNAUTHENTICATED' })

    const ORGANIZER_ROLES = ['DiveCenter', 'Agent', 'Liveaboard', 'DiveResort', 'DiveHostel', 'DiveSite']
    if (!ORGANIZER_ROLES.includes(user.role)) {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Only organizer roles can create booking templates.' })
    }

    return ctx.db.insert('bookingTemplates', {
      ownerId: user.slug,
      ownerType: user.role as 'DiveCenter' | 'Agent' | 'Liveaboard' | 'DiveResort' | 'DiveHostel' | 'DiveSite',
      name: args.name,
      activityType: args.activityType,
      createdAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { id: v.id('bookingTemplates') },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx)
    if (!user) throw new ConvexError({ code: 'UNAUTHENTICATED' })

    const template = await ctx.db.get(args.id)
    if (!template) throw new ConvexError({ code: 'NOT_FOUND' })
    if (template.ownerId !== user.slug) throw new ConvexError({ code: 'FORBIDDEN' })

    await ctx.db.delete(args.id)
  },
})
