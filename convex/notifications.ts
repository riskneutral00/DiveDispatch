import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth, type AnyCtx } from './lib/auth'

type NotificationType =
  | 'hold_placed'
  | 'hold_declined'
  | 'booking_cancelled'
  | 'booking_updated'
  | 'booking_referred'
  | 'medical_hard_block'
  | 'physician_clearance_submitted'
  | 'no_backup_available'
  | 'min_pax_not_met'

// notify() is a pure helper — called inline by other mutations, never exposed as a standalone endpoint.
export async function notify(
  ctx: AnyCtx,
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
    bookingId: args.bookingId,
    message: args.message,
    createdAt: Date.now(),
  })
}

// ─── createNotification ───────────────────────────────────────────────────────

export async function _createNotificationHandler(
  ctx: AnyCtx,
  args: {
    userId: string
    type: NotificationType
    bookingId?: string
    message: string
  },
): Promise<void> {
  await requireAuth(ctx)
  await notify(ctx, args)
}

export const createNotification = mutation({
  args: {
    userId: v.string(),
    type: v.union(
      v.literal('hold_placed'),
      v.literal('hold_declined'),
      v.literal('booking_cancelled'),
      v.literal('booking_updated'),
      v.literal('booking_referred'),
      v.literal('medical_hard_block'),
      v.literal('physician_clearance_submitted'),
      v.literal('no_backup_available'),
      v.literal('min_pax_not_met'),
    ),
    bookingId: v.optional(v.id('bookings')),
    message: v.string(),
  },
  handler: _createNotificationHandler,
})

// ─── markAsRead ───────────────────────────────────────────────────────────────

export async function _markAsReadHandler(
  ctx: AnyCtx,
  args: { notificationId: string },
): Promise<void> {
  const { user: caller } = await requireAuth(ctx)

  const notification = await ctx.db.get(args.notificationId)
  if (!notification) throw new ConvexError({ code: 'NOT_FOUND' })

  if (notification.userId !== caller.slug) throw new ConvexError({ code: 'FORBIDDEN' })

  await ctx.db.patch(args.notificationId, { readAt: Date.now() })
}

export const markAsRead = mutation({
  args: { notificationId: v.id('notifications') },
  handler: _markAsReadHandler,
})

// ─── deleteNotification ──────────────────────────────────────────────────────

export async function _deleteNotificationHandler(
  ctx: AnyCtx,
  args: { notificationId: string },
): Promise<void> {
  const { user: caller } = await requireAuth(ctx)

  const notification = await ctx.db.get(args.notificationId)
  if (!notification) throw new ConvexError({ code: 'NOT_FOUND' })

  if (notification.userId !== caller.slug) throw new ConvexError({ code: 'FORBIDDEN' })

  await ctx.db.delete(args.notificationId)
}

export const deleteNotification = mutation({
  args: { notificationId: v.id('notifications') },
  handler: _deleteNotificationHandler,
})

// ─── clearAll ────────────────────────────────────────────────────────────────

export async function _clearAllHandler(
  ctx: AnyCtx,
  args: { userId: string },
): Promise<number> {
  const { user: caller } = await requireAuth(ctx)

  if (args.userId !== caller.slug) throw new ConvexError({ code: 'FORBIDDEN' })

  const all = await ctx.db
    .query('notifications')
    .withIndex('by_userId', (q: AnyCtx) => q.eq('userId', args.userId))
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
  ctx: AnyCtx,
  args: { userId: string },
): Promise<number> {
  const notifications = await ctx.db
    .query('notifications')
    .withIndex('by_userId', (q: AnyCtx) => q.eq('userId', args.userId))
    .collect()

  return notifications.filter((n: AnyCtx) => n.readAt === undefined).length
}

export const getUnreadCount = query({
  args: { userId: v.string() },
  handler: _getUnreadCountHandler,
})

// ─── listNotifications ────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20

export async function _listNotificationsHandler(
  ctx: AnyCtx,
  args: { userId: string; limit?: number },
): Promise<unknown[]> {
  const limit = args.limit ?? DEFAULT_LIMIT

  return await ctx.db
    .query('notifications')
    .withIndex('by_userId', (q: AnyCtx) => q.eq('userId', args.userId))
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
