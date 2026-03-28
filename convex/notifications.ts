import { ConvexError, v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireAuth } from './lib/auth'
import { ErrorCode } from './lib/errorCodes'
import { type NotificationType, notificationTypeValidator } from './shared/statuses'

// notify() is a pure helper — called inline by other mutations, never exposed as a standalone endpoint.
export async function notify(
  ctx: MutationCtx,
  args: {
    userId: string
    type: NotificationType
    bookingId?: string
    message: string
  },
): Promise<void> {
  await ctx.db.insert('notifications', {
    userId: args.userId,
    type: args.type,
    bookingId: args.bookingId as Id<'bookings'> | undefined,
    message: args.message,
    createdAt: Date.now(),
  })
}

// ─── createNotification ───────────────────────────────────────────────────────

export async function _createNotificationHandler(
  ctx: MutationCtx,
  args: {
    userId: string
    type: NotificationType
    bookingId?: string
    message: string
  },
): Promise<void> {
  const { user } = await requireAuth(ctx)
  if (args.userId !== user.slug) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN })
  }
  await notify(ctx, args)
}

export const createNotification = mutation({
  args: {
    userId: v.string(),
    type: notificationTypeValidator,
    bookingId: v.optional(v.id('bookings')),
    message: v.string(),
  },
  handler: _createNotificationHandler,
})

// ─── markAsRead ───────────────────────────────────────────────────────────────

export async function _markAsReadHandler(
  ctx: MutationCtx,
  args: { notificationId: string },
): Promise<void> {
  const { user: caller } = await requireAuth(ctx)

  const notifId = args.notificationId as Id<'notifications'>
  const notification = await ctx.db.get(notifId)
  if (!notification) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  if (notification.userId !== caller.slug) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

  await ctx.db.patch(notifId, { readAt: Date.now() })
}

export const markAsRead = mutation({
  args: { notificationId: v.id('notifications') },
  handler: _markAsReadHandler,
})

// ─── deleteNotification ──────────────────────────────────────────────────────

export async function _deleteNotificationHandler(
  ctx: MutationCtx,
  args: { notificationId: string },
): Promise<void> {
  const { user: caller } = await requireAuth(ctx)

  const notifId = args.notificationId as Id<'notifications'>
  const notification = await ctx.db.get(notifId)
  if (!notification) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  if (notification.userId !== caller.slug) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

  await ctx.db.delete(notifId)
}

export const deleteNotification = mutation({
  args: { notificationId: v.id('notifications') },
  handler: _deleteNotificationHandler,
})

// ─── clearAll ────────────────────────────────────────────────────────────────

export async function _clearAllHandler(
  ctx: MutationCtx,
  args: { userId: string },
): Promise<number> {
  const { user: caller } = await requireAuth(ctx)

  if (args.userId !== caller.slug) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

  const all = await ctx.db
    .query('notifications')
    .withIndex('by_userId', (q) => q.eq('userId', args.userId))
    .collect()

  for (const n of all) {
    await ctx.db.delete(n._id)
  }

  return all.length
}

export const clearAll = mutation({
  args: { userId: v.string() },
  handler: _clearAllHandler,
})

// ─── getUnreadCount ───────────────────────────────────────────────────────────

export async function _getUnreadCountHandler(
  ctx: QueryCtx,
  args: { userId: string },
): Promise<number> {
  const { user: caller } = await requireAuth(ctx)
  if (args.userId !== caller.slug) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

  const notifications = await ctx.db
    .query('notifications')
    .withIndex('by_userId', (q) => q.eq('userId', args.userId))
    .collect()

  return notifications.filter((n) => n.readAt === undefined).length
}

export const getUnreadCount = query({
  args: { userId: v.string() },
  handler: _getUnreadCountHandler,
})

// ─── listNotifications ────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20

export async function _listNotificationsHandler(
  ctx: QueryCtx,
  args: { userId: string; limit?: number },
): Promise<unknown[]> {
  const { user: caller } = await requireAuth(ctx)
  if (args.userId !== caller.slug) throw new ConvexError({ code: ErrorCode.FORBIDDEN })

  const limit = args.limit ?? DEFAULT_LIMIT

  return await ctx.db
    .query('notifications')
    .withIndex('by_userId', (q) => q.eq('userId', args.userId))
    .order('desc')
    .take(limit)
}

export const listNotifications = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: _listNotificationsHandler,
})
