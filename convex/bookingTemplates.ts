import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { getAuthUser, OPERATOR_ROLE_SET } from './lib/auth'
import { requireActiveRole } from './userRoles'
import { courseCodeValidator as courseCode } from './shared/courseCodes'
import { ErrorCode } from './lib/errorCodes'
import { sanitizeFields, BOOKING_TEMPLATE_FIELDS } from './lib/sanitize'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'

export const list = query({
  args: { activeRole: stakeholderType },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx)
    if (!user) return []

    await requireActiveRole(ctx, user._id, args.activeRole)

    return ctx.db
      .query('bookingTemplates')
      .withIndex('by_ownerId_ownerType', (q) =>
        q.eq('ownerId', user.slug).eq('ownerType', args.activeRole as Doc<'bookingTemplates'>['ownerType']),
      )
      .collect()
  },
})

export const create = mutation({
  args: {
    activeRole: stakeholderType,
    name: v.string(),
    activityType: v.array(courseCode),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx)
    if (!user) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

    await requireActiveRole(ctx, user._id, args.activeRole)
    if (!OPERATOR_ROLE_SET.has(args.activeRole)) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'Only organizer roles can create booking templates.' })
    }

    const sanitized = sanitizeFields(args, BOOKING_TEMPLATE_FIELDS)
    return ctx.db.insert('bookingTemplates', {
      ownerId: user.slug,
      ownerType: args.activeRole as 'DiveCenter' | 'Agent' | 'Liveaboard' | 'DiveResort' | 'DiveHostel',
      name: sanitized.name,
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
