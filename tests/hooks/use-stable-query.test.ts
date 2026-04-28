// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockUseQuery = vi.fn()
const mockUseConvexAuth = vi.fn()

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useConvexAuth: () => mockUseConvexAuth(),
}))

import { useStableQuery } from '../../src/lib/hooks/use-stable-query'

// Fake query reference
const fakeQuery = {} as Parameters<typeof useStableQuery>[0]

describe('useStableQuery', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns isLoading=true while data is undefined', () => {
    mockUseQuery.mockReturnValue(undefined)
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false })
    const { result } = renderHook(() => useStableQuery(fakeQuery, {}))
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('returns data and isLoading=false when query resolves', () => {
    const data = { items: [1, 2, 3] }
    mockUseQuery.mockReturnValue(data)
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true })
    const { result } = renderHook(() => useStableQuery(fakeQuery, {}))
    expect(result.current.data).toBe(data)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it('sets isError=true after 8s timeout when authenticated', () => {
    mockUseQuery.mockReturnValue(undefined)
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true })
    const { result } = renderHook(() => useStableQuery(fakeQuery, {}))
    expect(result.current.isError).toBe(false)
    act(() => { vi.advanceTimersByTime(8000) })
    expect(result.current.isError).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })

  it('does not set isError before 8s', () => {
    mockUseQuery.mockReturnValue(undefined)
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true })
    const { result } = renderHook(() => useStableQuery(fakeQuery, {}))
    act(() => { vi.advanceTimersByTime(7999) })
    expect(result.current.isError).toBe(false)
  })

  it('clears error when data arrives', () => {
    mockUseQuery.mockReturnValue(undefined)
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true })
    const { result, rerender } = renderHook(() => useStableQuery(fakeQuery, {}))
    act(() => { vi.advanceTimersByTime(8000) })
    expect(result.current.isError).toBe(true)

    // Data arrives
    mockUseQuery.mockReturnValue({ items: [] })
    rerender()
    expect(result.current.isError).toBe(false)
    expect(result.current.isLoading).toBe(false)
  })

  it('returns not loading when args is "skip"', () => {
    mockUseQuery.mockReturnValue(undefined)
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true })
    const { result } = renderHook(() => useStableQuery(fakeQuery, 'skip'))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it('does not trigger timeout when not authenticated', () => {
    mockUseQuery.mockReturnValue(undefined)
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false })
    const { result } = renderHook(() => useStableQuery(fakeQuery, {}))
    act(() => { vi.advanceTimersByTime(10000) })
    expect(result.current.isError).toBe(false)
    expect(result.current.isLoading).toBe(true)
  })

  it('respects a caller-supplied timeoutMs override', () => {
    mockUseQuery.mockReturnValue(undefined)
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true })
    const { result } = renderHook(() => useStableQuery(fakeQuery, {}, { timeoutMs: 2000 }))
    act(() => { vi.advanceTimersByTime(1999) })
    expect(result.current.isError).toBe(false)
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.isError).toBe(true)
  })

  it('falls back to the 8000ms default when timeoutMs is omitted', () => {
    mockUseQuery.mockReturnValue(undefined)
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true })
    const { result } = renderHook(() => useStableQuery(fakeQuery, {}))
    act(() => { vi.advanceTimersByTime(7999) })
    expect(result.current.isError).toBe(false)
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.isError).toBe(true)
  })
})
