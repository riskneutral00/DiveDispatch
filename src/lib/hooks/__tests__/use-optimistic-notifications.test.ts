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

// Argument-keyed mock: routes useMutation calls based on the Convex function name symbol
const FUNCTION_NAME = Symbol.for('functionName')

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: () => mockNotifications,
    useMutation: (apiRef: Record<symbol, string>) => {
      const name: string = apiRef[FUNCTION_NAME] ?? ''
      if (name.includes('markAsRead')) return mockMarkAsRead
      if (name.includes('deleteNotification')) return mockDeleteNotification
      if (name.includes('clearAll')) return mockClearAll
      throw new Error(`Unexpected useMutation argument: ${name}`)
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

  // ─── Concurrency: ghost resurrection ──────────────────────────────────────

  it('concurrent markAsRead + delete on same ID: no ghost resurrection', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
      makeNotification({ _id: 'n-2' }),
    ]

    let resolveMarkAsRead!: () => void
    let resolveDelete!: () => void
    mockMarkAsRead.mockImplementation(
      () => new Promise<void>((resolve) => { resolveMarkAsRead = resolve }),
    )
    mockDeleteNotification.mockImplementation(
      () => new Promise<void>((resolve) => { resolveDelete = resolve }),
    )

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    // Fire markAsRead and delete concurrently on the same notification
    act(() => {
      result.current.handleMarkAsRead('n-1')
    })
    act(() => {
      result.current.handleDelete('n-1')
    })

    // n-1 should be deleted (delete wins over mark-as-read visually)
    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications?.[0]?._id).toBe('n-2')

    // Resolve markAsRead first — n-1 must NOT reappear
    await act(async () => {
      resolveMarkAsRead()
    })
    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications?.[0]?._id).toBe('n-2')

    // Resolve delete — n-1 still gone (server mock still has it, but delete cleanup is clean)
    await act(async () => {
      resolveDelete()
    })
    // After both resolve, optimistic state is cleared. Server still has n-1 since
    // the mock query doesn't change, but the delete-cleanup path should NOT leave
    // stale overrides that cause unexpected readAt on n-1.
    // With both optimistic flags cleared, server data shows through (both notifications).
    // This is correct: after success, we trust the server.
    expect(result.current.notifications).toHaveLength(2)
  })

  it('concurrent markAsRead + delete: delete resolution does not leave stale overrides', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
    ]

    let resolveMarkAsRead!: () => void
    let resolveDelete!: () => void
    mockMarkAsRead.mockImplementation(
      () => new Promise<void>((resolve) => { resolveMarkAsRead = resolve }),
    )
    mockDeleteNotification.mockImplementation(
      () => new Promise<void>((resolve) => { resolveDelete = resolve }),
    )

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    act(() => {
      result.current.handleMarkAsRead('n-1')
    })
    act(() => {
      result.current.handleDelete('n-1')
    })

    // Resolve delete first — should also clean up the overrides entry
    await act(async () => {
      resolveDelete()
    })

    // Then resolve markAsRead
    await act(async () => {
      resolveMarkAsRead()
    })

    // After both resolve, n-1 should show through from server with original readAt (undefined)
    // i.e., no stale optimistic readAt override lingering
    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications?.[0]?.readAt).toBeUndefined()
  })

  // ─── Concurrency: rapid duplicate calls ───────────────────────────────────

  it('rapid double handleMarkAsRead on same ID: second call is idempotent', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
    ]

    let resolveFirst!: () => void
    let callCount = 0
    mockMarkAsRead.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return new Promise<void>((resolve) => { resolveFirst = resolve })
      }
      return Promise.resolve()
    })

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    // First call
    act(() => {
      result.current.handleMarkAsRead('n-1')
    })

    // Second rapid call while first is in-flight — should be guarded
    act(() => {
      result.current.handleMarkAsRead('n-1')
    })

    // Only one mutation should have fired
    expect(mockMarkAsRead).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst()
    })
  })

  it('rapid triple handleMarkAsRead: only one mutation fires', async () => {
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
    act(() => {
      result.current.handleMarkAsRead('n-1')
    })
    act(() => {
      result.current.handleMarkAsRead('n-1')
    })

    expect(mockMarkAsRead).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveMarkAsRead()
    })
  })

  // ─── Concurrency: first succeeds, second errors ──────────────────────────

  it('first markAsRead succeeds, second errors: reflects server truth', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
      makeNotification({ _id: 'n-2' }),
    ]

    // n-1: succeeds
    let resolveFirst!: () => void
    mockMarkAsRead.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveFirst = resolve }),
    )
    // n-2: errors
    let rejectSecond!: (err: Error) => void
    mockMarkAsRead.mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => { rejectSecond = reject }),
    )

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    // Track the promises so we can ensure they settle before asserting
    let promise1: Promise<void>
    let promise2: Promise<void>
    act(() => {
      promise1 = result.current.handleMarkAsRead('n-1')
    })
    act(() => {
      promise2 = result.current.handleMarkAsRead('n-2')
    })

    // Both optimistically read
    expect(result.current.unreadCount).toBe(0)

    // First succeeds
    await act(async () => {
      resolveFirst()
      await promise1!
    })

    // Second errors (hook swallows the error internally)
    await act(async () => {
      rejectSecond(new Error('Server error'))
      await promise2!
    })

    // n-1 override cleared (success), server shows readAt=undefined
    // n-2 override cleared (revert), server shows readAt=undefined
    // Both reflect server truth
    expect(result.current.notifications?.[0]?.readAt).toBeUndefined()
    expect(result.current.notifications?.[1]?.readAt).toBeUndefined()
    expect(result.current.unreadCount).toBe(2)
  })

  // ─── Mock is argument-keyed ───────────────────────────────────────────────

  it('mock routes by api reference name, not call order', () => {
    // This test verifies the mock is argument-keyed.
    // We call useMutation with different api refs and verify correct mock is returned.
    // If the mock were position-keyed, reordering internal useMutation calls
    // would break mock assignment. With argument-keyed mocks, order is irrelevant.
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
    ]

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    // Verify each handler invokes the correct mutation mock
    mockMarkAsRead.mockResolvedValue(undefined)
    mockDeleteNotification.mockResolvedValue(undefined)

    act(() => {
      result.current.handleMarkAsRead('n-1')
    })
    expect(mockMarkAsRead).toHaveBeenCalledWith({ notificationId: 'n-1' })
    expect(mockDeleteNotification).not.toHaveBeenCalled()

    act(() => {
      result.current.handleDelete('n-1')
    })
    expect(mockDeleteNotification).toHaveBeenCalledWith({ notificationId: 'n-1' })
  })
})
