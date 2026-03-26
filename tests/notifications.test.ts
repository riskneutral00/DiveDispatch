import { describe, it, expect, beforeEach } from 'vitest'
import {
  notify,
  _createNotificationHandler,
  _markAsReadHandler,
  _deleteNotificationHandler,
  _clearAllHandler,
  _getUnreadCountHandler,
  _listNotificationsHandler,
} from '../convex/notifications'
import { TEST_TOKENS, TEST_SLUGS, seedUser, seedNotification } from './fixtures'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── notify() helper ──────────────────────────────────────────────────────────

describe('notify', () => {
  it('inserts a notification with correct fields', async () => {
    await t.run(async (ctx) => {
      await notify(ctx, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'New booking request',
      })

      const notifications = await ctx.db.query('notifications').collect()
      expect(notifications).toHaveLength(1)
      expect(notifications[0]).toMatchObject({
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'New booking request',
        createdAt: expect.any(Number),
      })
    })
  })

  it('inserts without bookingId when omitted', async () => {
    await t.run(async (ctx) => {
      await notify(ctx, {
        userId: TEST_SLUGS.diveCenter,
        type: 'booking_cancelled',
        message: 'Booking cancelled',
      })

      const notifications = await ctx.db.query('notifications').collect()
      expect(notifications[0]).toMatchObject({
        userId: TEST_SLUGS.diveCenter,
        type: 'booking_cancelled',
        message: 'Booking cancelled',
      })
      expect(notifications[0].bookingId).toBeUndefined()
    })
  })
})

// ─── createNotification ───────────────────────────────────────────────────────

describe('createNotification', () => {
  it('inserts a notification when authenticated', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)

      await _createNotificationHandler(ctx, {
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
        message: 'New booking request',
      })

      const notifications = await ctx.db.query('notifications').collect()
      expect(notifications).toHaveLength(1)
      expect(notifications[0]).toMatchObject({
        userId: TEST_SLUGS.diveCenter,
        type: 'hold_placed',
      })
    })
  })

  it('throws FORBIDDEN when userId does not match caller slug', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)

      await expect(
        _createNotificationHandler(ctx, {
          userId: 'some-other-user',
          type: 'hold_placed',
          message: 'injected notification',
        }),
      ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } })

      const notifications = await ctx.db.query('notifications').collect()
      expect(notifications).toHaveLength(0)
    })
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    await t.run(async (ctx) => {
      await expect(
        _createNotificationHandler(ctx, {
          userId: TEST_SLUGS.diveCenter,
          type: 'hold_placed',
          message: 'test',
        }),
      ).rejects.toMatchObject({ data: { code: 'UNAUTHENTICATED' } })
    })
  })
})

// ─── markAsRead ───────────────────────────────────────────────────────────────

describe('markAsRead', () => {
  it('sets readAt when caller owns the notification', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      const notifId = await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter })

      await _markAsReadHandler(ctx, { notificationId: notifId })

      const notif = await ctx.db.get(notifId)
      expect(notif?.readAt).toEqual(expect.any(Number))
    })
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    await t.run(async (ctx) => {
      await expect(
        _markAsReadHandler(ctx, { notificationId: 'irrelevant' }),
      ).rejects.toMatchObject({ data: { code: 'UNAUTHENTICATED' } })
    })
  })

  it('throws FORBIDDEN when caller does not own the notification', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.other }).run(async (ctx) => {
      // Caller user has slug 'other-user', notification belongs to 'blue-ocean'
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.other,
        slug: TEST_SLUGS.other,
        email: 'other@test.com',
      })
      const notifId = await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter })

      await expect(_markAsReadHandler(ctx, { notificationId: notifId })).rejects.toMatchObject({
        data: { code: 'FORBIDDEN' },
      })
    })
  })

  it('throws NOT_FOUND when notification does not exist', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      // Insert then immediately delete to get a valid-format but non-existent ID
      const notifId = await seedNotification(ctx)
      await ctx.db.delete(notifId)

      await expect(_markAsReadHandler(ctx, { notificationId: notifId })).rejects.toMatchObject({
        data: { code: 'NOT_FOUND' },
      })
    })
  })
})

// ─── getUnreadCount ───────────────────────────────────────────────────────────

describe('getUnreadCount', () => {
  it('returns count of notifications without readAt', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter }) // unread
      await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter }) // unread
      await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter, readAt: Date.now() }) // read

      const count = await _getUnreadCountHandler(ctx, { userId: TEST_SLUGS.diveCenter })
      expect(count).toBe(2)
    })
  })

  it('returns 0 when all notifications are read', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter, readAt: Date.now() })

      const count = await _getUnreadCountHandler(ctx, { userId: TEST_SLUGS.diveCenter })
      expect(count).toBe(0)
    })
  })

  it('returns 0 when user has no notifications', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      const count = await _getUnreadCountHandler(ctx, { userId: TEST_SLUGS.diveCenter })
      expect(count).toBe(0)
    })
  })

  it('throws FORBIDDEN when caller queries another user', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await expect(
        _getUnreadCountHandler(ctx, { userId: 'someone-else' }),
      ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } })
    })
  })
})

// ─── listNotifications ────────────────────────────────────────────────────────

describe('listNotifications', () => {
  it('returns notifications for the user', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter })
      await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter, readAt: Date.now() })

      const result = await _listNotificationsHandler(ctx, { userId: TEST_SLUGS.diveCenter })
      expect(result).toHaveLength(2)
    })
  })

  it('respects the limit parameter', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      for (let i = 0; i < 10; i++) {
        await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter, createdAt: i * 1000 })
      }

      const result = await _listNotificationsHandler(ctx, {
        userId: TEST_SLUGS.diveCenter,
        limit: 5,
      })
      expect(result).toHaveLength(5)
    })
  })

  it('uses default limit of 20 when no limit provided', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      for (let i = 0; i < 25; i++) {
        await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter, createdAt: i * 1000 })
      }

      const result = await _listNotificationsHandler(ctx, { userId: TEST_SLUGS.diveCenter })
      expect(result).toHaveLength(20)
    })
  })

  it('returns notifications in descending creation order', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      const n1 = await seedNotification(ctx, {
        userId: TEST_SLUGS.diveCenter,
        message: 'first',
      })
      const n2 = await seedNotification(ctx, {
        userId: TEST_SLUGS.diveCenter,
        message: 'second',
      })

      const result = await _listNotificationsHandler(ctx, { userId: TEST_SLUGS.diveCenter })
      // Most recently inserted (n2) should come first in desc order
      expect(result[0]._id).toBe(n2)
      expect(result[1]._id).toBe(n1)
    })
  })

  it('throws FORBIDDEN when caller queries another user', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await expect(
        _listNotificationsHandler(ctx, { userId: 'someone-else' }),
      ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } })
    })
  })
})

// ─── deleteNotification ──────────────────────────────────────────────────────

describe('deleteNotification', () => {
  it('deletes the notification when caller owns it', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      const notifId = await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter })

      await _deleteNotificationHandler(ctx, { notificationId: notifId })

      const notif = await ctx.db.get(notifId)
      expect(notif).toBeNull()
    })
  })

  it('throws NOT_FOUND when notification does not exist', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      // Insert then delete to get a valid-format but non-existent ID
      const notifId = await seedNotification(ctx)
      await ctx.db.delete(notifId)

      await expect(
        _deleteNotificationHandler(ctx, { notificationId: notifId }),
      ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
    })
  })

  it('throws FORBIDDEN when caller does not own the notification', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.other }).run(async (ctx) => {
      await seedUser(ctx, {
        tokenIdentifier: TEST_TOKENS.other,
        slug: TEST_SLUGS.other,
        email: 'other@test.com',
      })
      const notifId = await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter })

      await expect(
        _deleteNotificationHandler(ctx, { notificationId: notifId }),
      ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } })

      // Notification should still exist
      const notif = await ctx.db.get(notifId)
      expect(notif).not.toBeNull()
    })
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    await t.run(async (ctx) => {
      await expect(
        _deleteNotificationHandler(ctx, { notificationId: 'irrelevant' }),
      ).rejects.toMatchObject({ data: { code: 'UNAUTHENTICATED' } })
    })
  })
})

// ─── clearAll ────────────────────────────────────────────────────────────────

describe('clearAll', () => {
  it('deletes all notifications for the caller and returns count', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter })
      await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter })
      await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter, readAt: Date.now() })

      const count = await _clearAllHandler(ctx, { userId: TEST_SLUGS.diveCenter })
      expect(count).toBe(3)

      const remaining = await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', TEST_SLUGS.diveCenter))
        .collect()
      expect(remaining).toHaveLength(0)
    })
  })

  it('returns 0 when user has no notifications', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)

      const count = await _clearAllHandler(ctx, { userId: TEST_SLUGS.diveCenter })
      expect(count).toBe(0)
    })
  })

  it('only deletes notifications belonging to the caller, not others', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)
      await seedNotification(ctx, { userId: TEST_SLUGS.diveCenter })
      await seedNotification(ctx, { userId: 'someone-else' })

      const count = await _clearAllHandler(ctx, { userId: TEST_SLUGS.diveCenter })
      expect(count).toBe(1)

      // The other user's notification should still exist
      const otherNotifs = await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', 'someone-else'))
        .collect()
      expect(otherNotifs).toHaveLength(1)
    })
  })

  it('throws FORBIDDEN when userId does not match caller slug', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)

      await expect(
        _clearAllHandler(ctx, { userId: 'someone-else' }),
      ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } })
    })
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    await t.run(async (ctx) => {
      await expect(
        _clearAllHandler(ctx, { userId: TEST_SLUGS.diveCenter }),
      ).rejects.toMatchObject({ data: { code: 'UNAUTHENTICATED' } })
    })
  })
})
