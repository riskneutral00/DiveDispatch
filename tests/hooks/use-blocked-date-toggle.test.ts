// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockToggleBlockedDate = vi.fn()
let mockBlockedDates: string[] | undefined = []

vi.mock('convex/react', () => ({
  useQuery: () => mockBlockedDates,
  useMutation: () => mockToggleBlockedDate,
}))

import { useBlockedDateToggle } from '../../src/lib/hooks/use-blocked-date-toggle'

const PARAMS = { ownerSlug: 'jane-instructor', roleType: 'Instructor' } as const

describe('useBlockedDateToggle', () => {
  beforeEach(() => {
    mockBlockedDates = []
    mockToggleBlockedDate.mockReset()
    mockToggleBlockedDate.mockResolvedValue(undefined)
  })

  it('returns empty blocked dates initially', () => {
    const { result } = renderHook(() => useBlockedDateToggle(PARAMS))
    expect(result.current.blockedDates).toEqual([])
    expect(result.current.isToggling).toBe(false)
    expect(result.current.pendingToggle).toBeNull()
  })

  it('returns server-provided blocked dates', () => {
    mockBlockedDates = ['2026-04-01', '2026-04-05']
    const { result } = renderHook(() => useBlockedDateToggle(PARAMS))
    expect(result.current.blockedDates).toEqual(['2026-04-01', '2026-04-05'])
  })

  it('treats undefined query result as empty array', () => {
    mockBlockedDates = undefined
    const { result } = renderHook(() => useBlockedDateToggle(PARAMS))
    expect(result.current.blockedDates).toEqual([])
  })

  it('requestToggle sets pending with mode=block for unblocked date', () => {
    mockBlockedDates = []
    const { result } = renderHook(() => useBlockedDateToggle(PARAMS))
    act(() => { result.current.requestToggle('2026-04-10') })
    expect(result.current.pendingToggle).toEqual({ date: '2026-04-10', mode: 'block' })
  })

  it('requestToggle sets pending with mode=unblock for blocked date', () => {
    mockBlockedDates = ['2026-04-10']
    const { result } = renderHook(() => useBlockedDateToggle(PARAMS))
    act(() => { result.current.requestToggle('2026-04-10') })
    expect(result.current.pendingToggle).toEqual({ date: '2026-04-10', mode: 'unblock' })
  })

  it('cancelToggle clears pending', () => {
    const { result } = renderHook(() => useBlockedDateToggle(PARAMS))
    act(() => { result.current.requestToggle('2026-04-10') })
    expect(result.current.pendingToggle).not.toBeNull()
    act(() => { result.current.cancelToggle() })
    expect(result.current.pendingToggle).toBeNull()
  })

  it('confirmToggle applies optimistic block and calls mutation', async () => {
    mockBlockedDates = ['2026-04-01']
    const { result } = renderHook(() => useBlockedDateToggle(PARAMS))

    act(() => { result.current.requestToggle('2026-04-10') })
    expect(result.current.pendingToggle?.mode).toBe('block')

    await act(async () => { await result.current.confirmToggle() })

    expect(mockToggleBlockedDate).toHaveBeenCalledWith({
      date: '2026-04-10',
      roleType: 'Instructor',
    })
    expect(result.current.pendingToggle).toBeNull()
    expect(result.current.isToggling).toBe(false)
  })

  it('confirmToggle calls mutation for unblock and clears pending', async () => {
    mockBlockedDates = ['2026-04-01', '2026-04-10']
    const { result } = renderHook(() => useBlockedDateToggle(PARAMS))

    act(() => { result.current.requestToggle('2026-04-10') })
    expect(result.current.pendingToggle?.mode).toBe('unblock')

    await act(async () => { await result.current.confirmToggle() })

    expect(mockToggleBlockedDate).toHaveBeenCalledWith({
      date: '2026-04-10',
      roleType: 'Instructor',
    })
    expect(result.current.pendingToggle).toBeNull()
    expect(result.current.isToggling).toBe(false)
  })

  it('confirmToggle no-ops when no pending toggle', async () => {
    const { result } = renderHook(() => useBlockedDateToggle(PARAMS))
    await act(async () => { await result.current.confirmToggle() })
    expect(mockToggleBlockedDate).not.toHaveBeenCalled()
  })

  it('confirmToggle clears optimistic state even on mutation failure', async () => {
    mockToggleBlockedDate.mockRejectedValue(new Error('Server error'))
    mockBlockedDates = []
    const { result } = renderHook(() => useBlockedDateToggle(PARAMS))

    act(() => { result.current.requestToggle('2026-04-10') })
    await act(async () => {
      try { await result.current.confirmToggle() } catch { /* expected */ }
    })

    // Optimistic state cleared, falls back to server
    expect(result.current.isToggling).toBe(false)
    expect(result.current.blockedDates).toEqual([])
  })
})
