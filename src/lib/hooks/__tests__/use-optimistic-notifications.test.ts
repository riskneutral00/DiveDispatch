// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

let mockNotifications: Array<{
  _id: string
  type: string
  message: string
  createdAt: number
  readAt?: number
}> | undefined = []

const mockMarkAsRead = vi.fn<(args: { notificationId: string }) => Promise<void>>()
const mockDeleteNotification = vi.fn<(args: { notificationId: string }) => Promise<void>>()
const mockClearAll = vi.fn<(args: { userId: string }) => Promise<void>>()

// useMutation is called 3 times per render: markAsRead, deleteNotification, clearAll
let mutationCallCount = 0

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: () => mockNotifications,
    useMutation: () => {
      const idx = mutationCallCount % 3
      mutationCallCount++
      if (idx === 0) return mockMarkAsRead
      if (idx === 1) return mockDeleteNotification
      return mockClearAll
    },
  }
})

// Import AFTER mocks
import { useOptimisticNotifications } from '../use-optimistic-notifications'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNotification(overrides: Partial<typeof mockNotifications extends (infer T)[] | undefined ? T : never> & { _id: string }) {
  return {
    type: 'booking_accepted',
    message: 'Your booking was accepted',
    createdAt: Date.now(),
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useOptimisticNotifications', () => {
  beforeEach(() => {
    mutationCallCount = 0
    mockNotifications = []
    mockMarkAsRead.mockReset()
    mockDeleteNotification.mockReset()
    mockClearAll.mockReset()
    mockMarkAsRead.mockResolvedValue(undefined)
    mockDeleteNotification.mockResolvedValue(undefined)
    mockClearAll.mockResolvedValue(undefined)
  })

  it('returns server notifications when no optimistic state', () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
      makeNotification({ _id: 'n-2', readAt: 100 }),
    ]
    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    expect(result.current.notifications).toHaveLength(2)
    expect(result.current.unreadCount).toBe(1)
  })

  it('markAsRead optimistically sets readAt before mutation resolves', async () => {
    const now = Date.now()
    mockNotifications = [
      makeNotification({ _id: 'n-1', createdAt: now }),
    ]

    let resolveMarkAsRead!: () => void
    mockMarkAsRead.mockImplementation(
      () => new Promise<void>((resolve) => { resolveMarkAsRead = resolve }),
    )

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    // Before: notification is unread
    expect(result.current.unreadCount).toBe(1)

    // Trigger optimistic mark as read (synchronous act — no await).
    // The deferred mock never resolves during this act(), so if the
    // implementation set state AFTER await, readAt would still be undefined.
    act(() => {
      result.current.handleMarkAsRead('n-1')
    })

    // Mutation was invoked but its promise is still pending (not resolved)
    expect(mockMarkAsRead).toHaveBeenCalledTimes(1)
    // Optimistic state is already visible while mutation is in-flight
    expect(result.current.notifications?.[0]?.readAt).toBeTypeOf('number')
    expect(result.current.unreadCount).toBe(0)

    // Resolve and verify args
    await act(async () => {
      resolveMarkAsRead()
    })

    expect(mockMarkAsRead).toHaveBeenCalledWith({ notificationId: 'n-1' })
  })

  it('markAsRead reverts optimistic state on server rejection', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
    ]
    mockMarkAsRead.mockRejectedValue(new Error('Server error'))

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    await act(async () => {
      await result.current.handleMarkAsRead('n-1')
    })

    // After rejection: reverts to server state (unread)
    expect(result.current.notifications?.[0]?.readAt).toBeUndefined()
    expect(result.current.unreadCount).toBe(1)
  })

  it('deleteNotification optimistically removes notification before mutation resolves', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
      makeNotification({ _id: 'n-2' }),
    ]

    let resolveDelete!: () => void
    mockDeleteNotification.mockImplementation(
      () => new Promise<void>((resolve) => { resolveDelete = resolve }),
    )

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    expect(result.current.notifications).toHaveLength(2)

    act(() => {
      result.current.handleDelete('n-1')
    })

    // Mutation invoked but still pending (deferred promise)
    expect(mockDeleteNotification).toHaveBeenCalledTimes(1)
    // Optimistic state visible while mutation is in-flight
    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications?.[0]?._id).toBe('n-2')

    await act(async () => {
      resolveDelete()
    })

    expect(mockDeleteNotification).toHaveBeenCalledWith({ notificationId: 'n-1' })
  })

  it('deleteNotification reverts on server rejection', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
    ]
    mockDeleteNotification.mockRejectedValue(new Error('Server error'))

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    await act(async () => {
      await result.current.handleDelete('n-1')
    })

    // After rejection: notification restored
    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications?.[0]?._id).toBe('n-1')
  })

  it('clearAll optimistically removes all notifications before mutation resolves', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
      makeNotification({ _id: 'n-2' }),
    ]

    let resolveClearAll!: () => void
    mockClearAll.mockImplementation(
      () => new Promise<void>((resolve) => { resolveClearAll = resolve }),
    )

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    act(() => {
      result.current.handleClearAll()
    })

    // Mutation invoked but still pending (deferred promise)
    expect(mockClearAll).toHaveBeenCalledTimes(1)
    // Optimistic state visible while mutation is in-flight
    expect(result.current.notifications).toHaveLength(0)
    expect(result.current.unreadCount).toBe(0)

    await act(async () => {
      resolveClearAll()
    })

    expect(mockClearAll).toHaveBeenCalledWith({ userId: 'user-1' })
  })

  it('clearAll reverts on server rejection', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
      makeNotification({ _id: 'n-2' }),
    ]
    mockClearAll.mockRejectedValue(new Error('Server error'))

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    await act(async () => {
      await result.current.handleClearAll()
    })

    // After rejection: all restored
    expect(result.current.notifications).toHaveLength(2)
  })

  it('markAsRead clears optimistic override after successful mutation', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
    ]

    let resolveMarkAsRead!: () => void
    mockMarkAsRead.mockImplementation(
      () => new Promise<void>((resolve) => { resolveMarkAsRead = resolve }),
    )

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    act(() => {
      result.current.handleMarkAsRead('n-1')
    })

    // Optimistic readAt is a number while mutation is in-flight
    expect(result.current.notifications?.[0]?.readAt).toBeTypeOf('number')

    // Resolve mutation — success path clears optimistic override
    await act(async () => {
      resolveMarkAsRead()
    })

    // After success: override cleared, server data (readAt: undefined) shows through
    expect(result.current.notifications?.[0]?.readAt).toBeUndefined()
  })

  it('deleteNotification clears optimistic delete after successful mutation', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
      makeNotification({ _id: 'n-2' }),
    ]

    let resolveDelete!: () => void
    mockDeleteNotification.mockImplementation(
      () => new Promise<void>((resolve) => { resolveDelete = resolve }),
    )

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    act(() => {
      result.current.handleDelete('n-1')
    })

    // Optimistically removed
    expect(result.current.notifications).toHaveLength(1)

    // Resolve mutation — success path clears optimistic delete
    await act(async () => {
      resolveDelete()
    })

    // After success: override cleared, server data shows through again
    // (server still has n-1 since we're using a mock query)
    expect(result.current.notifications).toHaveLength(2)
  })

  it('clearAll clears optimistic flag after successful mutation', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
      makeNotification({ _id: 'n-2' }),
    ]

    let resolveClearAll!: () => void
    mockClearAll.mockImplementation(
      () => new Promise<void>((resolve) => { resolveClearAll = resolve }),
    )

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    act(() => {
      result.current.handleClearAll()
    })

    // Optimistically cleared
    expect(result.current.notifications).toHaveLength(0)

    // Resolve mutation — success path resets optimisticClearedAll
    await act(async () => {
      resolveClearAll()
    })

    // After success: flag cleared, server data shows through again
    // (server still has notifications since we're using a mock query)
    expect(result.current.notifications).toHaveLength(2)
  })

  it('returns undefined notifications while loading', () => {
    mockNotifications = undefined

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    expect(result.current.notifications).toBeUndefined()
    expect(result.current.unreadCount).toBe(0)
  })
})
