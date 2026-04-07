// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

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

import { useOptimisticNotifications } from '../use-optimistic-notifications'

function makeNotification(overrides: Partial<typeof mockNotifications extends (infer T)[] | undefined ? T : never> & { _id: string }) {
  return {
    type: 'booking_accepted',
    message: 'Your booking was accepted',
    createdAt: Date.now(),
    ...overrides,
  }
}

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

    expect(result.current.unreadCount).toBe(1)

    act(() => {
      result.current.handleMarkAsRead('n-1')
    })

    expect(mockMarkAsRead).toHaveBeenCalledTimes(1)
    expect(result.current.notifications?.[0]?.readAt).toBeTypeOf('number')
    expect(result.current.unreadCount).toBe(0)

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

    expect(mockDeleteNotification).toHaveBeenCalledTimes(1)
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

    expect(mockClearAll).toHaveBeenCalledTimes(1)
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

    expect(result.current.notifications?.[0]?.readAt).toBeTypeOf('number')

    await act(async () => {
      resolveMarkAsRead()
    })

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

    expect(result.current.notifications).toHaveLength(1)

    await act(async () => {
      resolveDelete()
    })

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

    expect(result.current.notifications).toHaveLength(0)

    await act(async () => {
      resolveClearAll()
    })

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

    act(() => {
      result.current.handleMarkAsRead('n-1')
    })
    act(() => {
      result.current.handleDelete('n-1')
    })

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications?.[0]?._id).toBe('n-2')

    await act(async () => {
      resolveMarkAsRead()
    })
    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications?.[0]?._id).toBe('n-2')

    await act(async () => {
      resolveDelete()
    })
    expect(result.current.notifications).toHaveLength(2)
  })

  it('concurrent markAsRead + delete: delete resolution does not leave stale overrides', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1', readAt: 100 }),
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

    await act(async () => {
      resolveDelete()
    })

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications?.[0]?.readAt).toBe(100)

    await act(async () => {
      resolveMarkAsRead()
    })

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications?.[0]?.readAt).toBe(100)
  })

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

    act(() => {
      result.current.handleMarkAsRead('n-1')
    })

    act(() => {
      result.current.handleMarkAsRead('n-1')
    })

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

  it('handleMarkAsRead in-flight guard releases after resolve — second call fires', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
    ]

    let resolveFirst!: () => void
    let resolveSecond!: () => void
    let callCount = 0
    mockMarkAsRead.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return new Promise<void>((resolve) => { resolveFirst = resolve })
      }
      return new Promise<void>((resolve) => { resolveSecond = resolve })
    })

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    act(() => {
      result.current.handleMarkAsRead('n-1')
    })
    expect(mockMarkAsRead).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.handleMarkAsRead('n-1')
    })
    expect(mockMarkAsRead).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst()
    })

    act(() => {
      result.current.handleMarkAsRead('n-1')
    })
    expect(mockMarkAsRead).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveSecond()
    })
  })

  it('rapid double handleClearAll: second call is deduplicated, only one mutation fires', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
      makeNotification({ _id: 'n-2' }),
    ]

    let resolveFirst!: () => void
    mockClearAll.mockImplementation(
      () => new Promise<void>((resolve) => { resolveFirst = resolve }),
    )

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    act(() => {
      result.current.handleClearAll()
    })

    act(() => {
      result.current.handleClearAll()
    })

    expect(mockClearAll).toHaveBeenCalledTimes(1)

    expect(result.current.notifications).toHaveLength(0)

    await act(async () => {
      resolveFirst()
    })

    expect(result.current.notifications).toHaveLength(2)
  })

  it('handleClearAll in-flight guard releases after first resolves — second call then fires', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
    ]

    let resolveFirst!: () => void
    let resolveSecond!: () => void
    let callCount = 0
    mockClearAll.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return new Promise<void>((resolve) => { resolveFirst = resolve })
      }
      return new Promise<void>((resolve) => { resolveSecond = resolve })
    })

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    act(() => {
      result.current.handleClearAll()
    })
    expect(mockClearAll).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.handleClearAll()
    })
    expect(mockClearAll).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst()
    })

    act(() => {
      result.current.handleClearAll()
    })
    expect(mockClearAll).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveSecond()
    })
  })

  it('first markAsRead succeeds, second errors: reflects server truth', async () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
      makeNotification({ _id: 'n-2' }),
    ]

    let resolveFirst!: () => void
    mockMarkAsRead.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveFirst = resolve }),
    )
    let rejectSecond!: (err: Error) => void
    mockMarkAsRead.mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => { rejectSecond = reject }),
    )

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

    let promise1: Promise<void>
    let promise2: Promise<void>
    act(() => {
      promise1 = result.current.handleMarkAsRead('n-1')
    })
    act(() => {
      promise2 = result.current.handleMarkAsRead('n-2')
    })

    expect(result.current.unreadCount).toBe(0)

    await act(async () => {
      resolveFirst()
      await promise1!
    })

    await act(async () => {
      rejectSecond(new Error('Server error'))
      await promise2!
    })

    expect(result.current.notifications?.[0]?.readAt).toBeUndefined()
    expect(result.current.notifications?.[1]?.readAt).toBeUndefined()
    expect(result.current.unreadCount).toBe(2)
  })

  it('mock routes by api reference name, not call order', () => {
    mockNotifications = [
      makeNotification({ _id: 'n-1' }),
    ]

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20 }),
    )

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

  it('markAsRead calls onError callback on server rejection', async () => {
    mockNotifications = [makeNotification({ _id: 'n-1' })]
    mockMarkAsRead.mockRejectedValue(new Error('Server error'))
    const onError = vi.fn()

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20, onError }),
    )

    await act(async () => {
      await result.current.handleMarkAsRead('n-1')
    })

    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith('markAsRead')
  })

  it('deleteNotification calls onError callback on server rejection', async () => {
    mockNotifications = [makeNotification({ _id: 'n-1' })]
    mockDeleteNotification.mockRejectedValue(new Error('Server error'))
    const onError = vi.fn()

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20, onError }),
    )

    await act(async () => {
      await result.current.handleDelete('n-1')
    })

    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith('delete')
  })

  it('clearAll calls onError callback on server rejection', async () => {
    mockNotifications = [makeNotification({ _id: 'n-1' })]
    mockClearAll.mockRejectedValue(new Error('Server error'))
    const onError = vi.fn()

    const { result } = renderHook(() =>
      useOptimisticNotifications({ userId: 'user-1', limit: 20, onError }),
    )

    await act(async () => {
      await result.current.handleClearAll()
    })

    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith('clearAll')
  })
})
