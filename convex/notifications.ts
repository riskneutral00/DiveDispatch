import { ConvexError, v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { authorize, requireAuth } from './lib/auth'
import { ErrorCode } from './lib/errorCodes'
import { batchDelete, batchGet } from './lib/batch'
import { checkIdempotency } from './lib/idempotency'
import { type NotificationType, clientNotificationTypeValidator, CLIENT_NOTIFICATION_TYPES, NOTIFICATION_TYPE } from './shared/statuses'

export type { NotificationLogistics } from './shared/notificationLogistics'
import type { NotificationLogistics } from './shared/notificationLogistics'

export async function notify(
  ctx: MutationCtx,
  args: {
    userId: string
    type: NotificationType
    bookingId?: Id<'bookings'>
    message: string
    code?: string
    params?: Record<string, string>
    logistics?: NotificationLogistics
  },
): Promise<void> {
  await ctx.db.insert('notifications', {
    userId: args.userId,
    type: args.type,
    bookingId: args.bookingId,
    message: args.message,
    ...(args.code !== undefined ? { code: args.code } : {}),
    ...(args.params !== undefined ? { params: JSON.stringify(args.params) } : {}),
    createdAt: Date.now(),
    ...(args.logistics !== undefined ? { logistics: args.logistics } : {}),
  })
}

export async function notifyReleasedInventory(
  ctx: MutationCtx,
  bookingId: Id<'bookings'>,
  vacatedReservations: Doc<'reservations'>[],
): Promise<void> {
  if (vacatedReservations.length === 0) return

  const uniqueUnitIds = [...new Set(vacatedReservations.map((r) => r.inventoryUnitId))]
  const units = await batchGet(ctx, uniqueUnitIds)

  for (const unit of units) {
    if (!unit) continue
    await notify(ctx, {
      userId: unit.ownerId,
      type: NOTIFICATION_TYPE.BookingCancelled,
      bookingId,
      code: 'booking_cancelled_inventory_released',
      params: { resourceName: unit.displayName },
      message: `Booking cancelled — your ${unit.displayName} inventory has been released.`,
    })
  }
}

export async function _createNotificationHandler(
  ctx: MutationCtx,
  args: {
    userId: string
    type: NotificationType
    bookingId?: Id<'bookings'>
    message: string
    idempotencyKey?: string
  },
): Promise<void> {
  await authorize(ctx, null, 'notification:manage', { type: 'notification', ownerId: args.userId })

  if (!CLIENT_NOTIFICATION_TYPES.has(args.type)) {
    throw new ConvexError({ code: ErrorCode.INVALID_INPUT, reason: `Invalid notification type for client creation: ${args.type}` })
  }

  if (args.idempotencyKey) {
    const isDuplicate = await checkIdempotency(ctx, args.idempotencyKey, 'createNotification')
    if (isDuplicate) return
  }

  await notify(ctx, args)
}

export const createNotification = mutation({
  args: {
    userId: v.string(),
    type: clientNotificationTypeValidator,
    bookingId: v.optional(v.id('bookings')),
    message: v.string(),
    idempotencyKey: v.optional(v.string()),
  },
  handler: _createNotificationHandler,
})

export async function _markAsReadHandler(
  ctx: MutationCtx,
  args: { notificationId: string },
): Promise<void> {
  const { user } = await authorize(ctx, null, 'notification:manage', { type: 'notification' })

  const notifId = args.notificationId as Id<'notifications'>
  const notification = await ctx.db.get(notifId)
  if (!notification) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  if (notification.userId !== user.slug) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN })
  }

  await ctx.db.patch(notifId, { readAt: Date.now() })
}

export const markAsRead = mutation({
  args: { notificationId: v.id('notifications') },
  handler: _markAsReadHandler,
})

export async function _deleteNotificationHandler(
  ctx: MutationCtx,
  args: { notificationId: string },
): Promise<void> {
  const { user } = await authorize(ctx, null, 'notification:manage', { type: 'notification' })

  const notifId = args.notificationId as Id<'notifications'>
  const notification = await ctx.db.get(notifId)
  if (!notification) throw new ConvexError({ code: ErrorCode.NOT_FOUND })

  if (notification.userId !== user.slug) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN })
  }

  await ctx.db.delete(notifId)
}

export const deleteNotification = mutation({
  args: { notificationId: v.id('notifications') },
  handler: _deleteNotificationHandler,
})

export async function _clearAllHandler(
  ctx: MutationCtx,
  args: { userId: string },
): Promise<number> {
  await authorize(ctx, null, 'notification:manage', { type: 'notification', ownerId: args.userId })

  const BATCH = 500
  const batch = await ctx.db
    .query('notifications')
    .withIndex('by_userId_createdAt', (q) => q.eq('userId', args.userId))
    .take(BATCH)

  await batchDelete(ctx, batch)

  return batch.length
}

export const clearAll = mutation({
  args: { userId: v.string() },
  handler: _clearAllHandler,
})

export async function _getUnreadCountHandler(
  ctx: QueryCtx,
  args: { userId: string },
): Promise<number> {
  const { user: caller } = await requireAuth(ctx)
  if (caller.slug !== args.userId) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN })
  }

  const MAX_COUNT = 999
  const unread = await ctx.db
    .query('notifications')
    .withIndex('by_userId_readAt', (q) => q.eq('userId', args.userId).eq('readAt', undefined))
    .take(MAX_COUNT)

  return unread.length
}

export const getUnreadCount = query({
  args: { userId: v.string() },
  handler: _getUnreadCountHandler,
})

const DEFAULT_LIMIT = 20
const SERVER_MAX_NOTIFICATIONS = 50

export async function _listNotificationsHandler(
  ctx: QueryCtx,
  args: { userId: string; limit?: number },
): Promise<unknown[]> {
  const { user: caller } = await requireAuth(ctx)
  if (caller.slug !== args.userId) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN })
  }

  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, SERVER_MAX_NOTIFICATIONS)

  return await ctx.db
    .query('notifications')
    .withIndex('by_userId_createdAt', (q) => q.eq('userId', args.userId))
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
