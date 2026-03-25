import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { getAuthUser } from './lib/auth'
import { checkHasAnyOperatorRole } from './userRoles'
import { courseCodeValidator as courseCode } from './shared/courseCodes'
import { ErrorCode } from './lib/errorCodes'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx)
    if (!user) return []

    return ctx.db
      .query('bookingTemplates')
      .withIndex('by_ownerId_ownerType', (q) =>
        q.eq('ownerId', user.slug).eq('ownerType', user.role as Doc<'bookingTemplates'>['ownerType']),
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
    if (!user) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

    if (!await checkHasAnyOperatorRole(ctx, user._id)) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, message: 'Only organizer roles can create booking templates.' })
    }

    return ctx.db.insert('bookingTemplates', {
      ownerId: user.slug,
      ownerType: user.role as 'DiveCenter' | 'Agent' | 'Liveaboard' | 'DiveResort' | 'DiveHostel',
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
    if (!user) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

    const template = await ctx.db.get(args.id)
    if (!template) throw new ConvexError({ code: ErrorCode.NOT_FOUND })
    if (template.ownerId !== user.slug) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

    await ctx.db.delete(args.id)
  },
})
