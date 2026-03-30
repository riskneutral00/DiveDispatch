import { ConvexError, v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireAuth } from './lib/auth'
import { ErrorCode } from './lib/errorCodes'
import { batchDelete, batchGet } from './lib/batch'
import { checkIdempotency } from './lib/idempotency'
import { type NotificationType, notificationTypeValidator, clientNotificationTypeValidator, NOTIFICATION_TYPE } from './shared/statuses'

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

/**
 * Notify resource stakeholders whose inventory was released by a booking cancellation.
 * Deduplicates by inventoryUnitId — each unique unit's owner gets one notification.
 * Uses batchGet to avoid N+1 sequential ctx.db.get() calls.
 */
export async function notifyVacatedStakeholders(
  ctx: MutationCtx,
  bookingId: string,
  vacatedBy?: string,
): Promise<void> {
  const vacatedReservations = await ctx.db
    .query('reservations')
    .withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId as Id<'bookings'>))
    .collect()
  const vacated = vacatedReservations.filter((r) =>
    r.status === 'Vacated' && (vacatedBy === undefined || r.vacatedBy === vacatedBy),
  )
  if (vacated.length === 0) return

  // Deduplicate by inventoryUnitId
  const uniqueUnitIds = [...new Set(vacated.map((r) => r.inventoryUnitId))]
  const units = await batchGet(ctx, uniqueUnitIds)

  for (const unit of units) {
    if (!unit) continue
    await notify(ctx, {
      userId: unit.ownerId,
      type: NOTIFICATION_TYPE.BookingCancelled,
      bookingId,
      message: `Booking cancelled — your ${unit.displayName} inventory has been released.`,
    })
  }
}

/**
 * Notify resource stakeholders about released inventory using already-known vacated reservations.
 * Deduplicates by inventoryUnitId — each unique unit's owner gets one notification.
 * Batch-fetches units with Promise.all to avoid N+1 sequential db.get() calls.
 *
 * Callers pass the vacated reservation list returned by releaseBookingReservations,
 * eliminating the re-query that notifyVacatedStakeholders performs.
 */
export async function notifyReleasedInventory(
  ctx: MutationCtx,
  bookingId: string,
  vacatedReservations: Doc<'reservations'>[],
): Promise<void> {
  if (vacatedReservations.length === 0) return

  // Deduplicate by inventoryUnitId
  const uniqueUnitIds = [...new Set(vacatedReservations.map((r) => r.inventoryUnitId))]
  const units = await batchGet(ctx, uniqueUnitIds)

  for (const unit of units) {
    if (!unit) continue
    await notify(ctx, {
      userId: unit.ownerId,
      type: NOTIFICATION_TYPE.BookingCancelled,
      bookingId,
      message: `Booking cancelled — your ${unit.displayName} inventory has been released.`,
    })
  }
}

// ─── createNotification ───────────────────────────────────────────────────────

export async function _createNotificationHandler(
  ctx: MutationCtx,
  args: {
    userId: string
    type: NotificationType
    bookingId?: string
    message: string
    idempotencyKey?: string
  },
): Promise<void> {
  const { user } = await requireAuth(ctx)
  if (args.userId !== user.slug) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN })
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

  await batchDelete(ctx, all)

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
