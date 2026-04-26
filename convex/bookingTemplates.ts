import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { authorizeWithRole, getAuthUser, OPERATOR_ROLE_SET } from './lib/auth'
import { requireActiveRole } from './userRoles'
import { courseCodeValidator as courseCode } from './shared/courseCodes'
import { ErrorCode } from './lib/errorCodes'
import { sanitizeFields, BOOKING_TEMPLATE_FIELDS } from './lib/sanitize'
import { stakeholderTypeValidator as stakeholderType } from './lib/validators'
import { resourceOwnerTypeValidator as resourceOwnerType } from './shared/resourceOwnerTypes'
import type { OperatorType } from './shared/operatorTypes'

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
      .take(50)
  },
})

export const create = mutation({
  args: {
    activeRole: stakeholderType,
    name: v.string(),
    activityType: v.array(courseCode),
    resources: v.optional(
      v.array(
        v.object({
          resourceType: resourceOwnerType,
          resourceId: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    if (!OPERATOR_ROLE_SET.has(args.activeRole)) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'Only organizer roles can create booking templates.' })
    }
    const { user } = await authorizeWithRole(ctx, 'booking:create', args.activeRole, { type: 'resource' })

    const sanitized = sanitizeFields(args, BOOKING_TEMPLATE_FIELDS)
    return ctx.db.insert('bookingTemplates', {
      ownerId: user.slug,
      ownerType: args.activeRole as OperatorType,
      name: sanitized.name,
      activityType: args.activityType,
      ...(args.resources?.length ? { resources: args.resources } : {}),
      createdAt: Date.now(),
    })
  },
})

