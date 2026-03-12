import { describe, it, expect, vi } from 'vitest'
import { ConvexError } from 'convex/values'

// Vitest mock for the Convex generated server module (not present in worktree)
vi.mock('../convex/_generated/server', () => ({
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
  internalMutation: (config: unknown) => config,
  internalQuery: (config: unknown) => config,
}))

import {
  notify,
  _createNotificationHandler,
  _markAsReadHandler,
  _getUnreadCountHandler,
  _listNotificationsHandler,
} from '../convex/notifications'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER = {
  _id: 'u1',
  slug: 'dc-slug',
  tokenIdentifier: 'user|123',
  role: 'DiveCenter',
}

const OTHER_USER = {
  _id: 'u2',
  slug: 'other-slug',
  tokenIdentifier: 'user|456',
  role: 'Instructor',
}

const NOTIFICATION_UNREAD = {
  _id: 'notif1',
  userId: 'dc-slug',
  type: 'hold_placed',
  bookingId: 'booking1',
  message: 'New booking request',
  createdAt: 1000,
  readAt: undefined,
}

const NOTIFICATION_READ = {
  _id: 'notif2',
  userId: 'dc-slug',
  type: 'hold_declined',
  bookingId: 'booking1',
  message: 'Instructor declined',
  createdAt: 900,
  readAt: 1100,
}

// ─── Mock factory ─────────────────────────────────────────────────────────────

function makeCtx({
  identity = { tokenIdentifier: 'user|123' } as unknown,
  userByToken = USER as unknown,
  docsById = {} as Record<string, unknown>,
  notifications = [] as unknown[],
} = {}) {
  const defaultDocs: Record<string, unknown> = {
    u1: USER,
    notif1: NOTIFICATION_UNREAD,
    notif2: NOTIFICATION_READ,
    ...docsById,
  }

  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(identity),
    },
    db: {
      get: vi.fn().mockImplementation((id: string) => Promise.resolve(defaultDocs[id] ?? null)),
      patch: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockResolvedValue('new-notif-id'),
      delete: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockImplementation((table: string) => {
        let collectResult: unknown[] = []
        let uniqueResult: unknown = null
        let takeResult: unknown[] = []

        if (table === 'users') {
          uniqueResult = userByToken
          collectResult = userByToken ? [userByToken] : []
        } else if (table === 'notifications') {
          collectResult = notifications
          uniqueResult = notifications[0] ?? null
          takeResult = notifications
        }

        const chain = {
          withIndex: vi.fn(),
          collect: vi.fn().mockResolvedValue(collectResult),
          unique: vi.fn().mockResolvedValue(uniqueResult),
          first: vi.fn().mockResolvedValue(collectResult[0] ?? null),
          order: vi.fn(),
          take: vi.fn().mockResolvedValue(takeResult),
        }
        chain.withIndex.mockReturnValue(chain)
        chain.order.mockReturnValue(chain)
        return chain
      }),
    },
  }
}

function expectConvexError(err: unknown, code: string) {
  expect(err).toBeInstanceOf(ConvexError)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((err as ConvexError<any>).data).toMatchObject({ code })
}

// ─── notify() helper ──────────────────────────────────────────────────────────

describe('notify', () => {
  it('inserts a notification with correct fields', async () => {
    const ctx = makeCtx()

    await notify(ctx, {
      userId: 'dc-slug',
      type: 'hold_placed',
      bookingId: 'booking1',
      message: 'New booking request',
    })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        userId: 'dc-slug',
        type: 'hold_placed',
        bookingId: 'booking1',
        message: 'New booking request',
        createdAt: expect.any(Number),
      }),
    )
  })

  it('inserts without bookingId when omitted', async () => {
    const ctx = makeCtx()

    await notify(ctx, {
      userId: 'dc-slug',
      type: 'booking_cancelled',
      message: 'Booking cancelled',
    })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        userId: 'dc-slug',
        type: 'booking_cancelled',
        message: 'Booking cancelled',
      }),
    )
  })
})

// ─── createNotification ───────────────────────────────────────────────────────

describe('createNotification', () => {
  it('inserts a notification when authenticated', async () => {
    const ctx = makeCtx()

    await _createNotificationHandler(ctx, {
      userId: 'dc-slug',
      type: 'hold_placed',
      message: 'New booking request',
    })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        userId: 'dc-slug',
        type: 'hold_placed',
      }),
    )
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    const ctx = makeCtx({ identity: null })

    await expect(
      _createNotificationHandler(ctx, {
        userId: 'dc-slug',
        type: 'hold_placed',
        message: 'test',
      }),
    ).rejects.toSatisfy((err) => {
      expectConvexError(err, 'UNAUTHENTICATED')
      return true
    })
  })
})

// ─── markAsRead ───────────────────────────────────────────────────────────────

describe('markAsRead', () => {
  it('patches readAt when caller owns the notification', async () => {
    const ctx = makeCtx()

    await _markAsReadHandler(ctx, { notificationId: 'notif1' })

    expect(ctx.db.patch).toHaveBeenCalledWith(
      'notif1',
      expect.objectContaining({ readAt: expect.any(Number) }),
    )
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    const ctx = makeCtx({ identity: null })

    await expect(_markAsReadHandler(ctx, { notificationId: 'notif1' })).rejects.toSatisfy(
      (err) => {
        expectConvexError(err, 'UNAUTHENTICATED')
        return true
      },
    )
  })

  it('throws FORBIDDEN when caller does not own the notification', async () => {
    const ctx = makeCtx({ userByToken: OTHER_USER })

    await expect(_markAsReadHandler(ctx, { notificationId: 'notif1' })).rejects.toSatisfy(
      (err) => {
        expectConvexError(err, 'FORBIDDEN')
        return true
      },
    )
  })

  it('throws NOT_FOUND when notification does not exist', async () => {
    const ctx = makeCtx({ docsById: { notif1: null } })

    await expect(_markAsReadHandler(ctx, { notificationId: 'notif1' })).rejects.toSatisfy(
      (err) => {
        expectConvexError(err, 'NOT_FOUND')
        return true
      },
    )
  })
})

// ─── getUnreadCount ───────────────────────────────────────────────────────────

describe('getUnreadCount', () => {
  it('returns count of notifications without readAt', async () => {
    const ctx = makeCtx({
      notifications: [NOTIFICATION_UNREAD, NOTIFICATION_UNREAD, NOTIFICATION_READ],
    })

    const count = await _getUnreadCountHandler(ctx, { userId: 'dc-slug' })

    expect(count).toBe(2)
  })

  it('returns 0 when all notifications are read', async () => {
    const ctx = makeCtx({ notifications: [NOTIFICATION_READ] })

    const count = await _getUnreadCountHandler(ctx, { userId: 'dc-slug' })

    expect(count).toBe(0)
  })

  it('returns 0 when user has no notifications', async () => {
    const ctx = makeCtx({ notifications: [] })

    const count = await _getUnreadCountHandler(ctx, { userId: 'dc-slug' })

    expect(count).toBe(0)
  })
})

// ─── listNotifications ────────────────────────────────────────────────────────

describe('listNotifications', () => {
  it('returns notifications for the user', async () => {
    const ctx = makeCtx({ notifications: [NOTIFICATION_UNREAD, NOTIFICATION_READ] })

    const result = await _listNotificationsHandler(ctx, { userId: 'dc-slug' })

    expect(result).toHaveLength(2)
  })

  it('passes limit to take', async () => {
    const ctx = makeCtx({ notifications: [NOTIFICATION_UNREAD] })

    await _listNotificationsHandler(ctx, { userId: 'dc-slug', limit: 5 })

    // Verify take was called with the provided limit
    const queryChain = ctx.db.query.mock.results[0].value
    expect(queryChain.take).toHaveBeenCalledWith(5)
  })

  it('uses default limit of 20 when not specified', async () => {
    const ctx = makeCtx({ notifications: [] })

    await _listNotificationsHandler(ctx, { userId: 'dc-slug' })

    const queryChain = ctx.db.query.mock.results[0].value
    expect(queryChain.take).toHaveBeenCalledWith(20)
  })

  it('orders results descending', async () => {
    const ctx = makeCtx({ notifications: [NOTIFICATION_UNREAD, NOTIFICATION_READ] })

    await _listNotificationsHandler(ctx, { userId: 'dc-slug' })

    const queryChain = ctx.db.query.mock.results[0].value
    expect(queryChain.order).toHaveBeenCalledWith('desc')
  })
})
