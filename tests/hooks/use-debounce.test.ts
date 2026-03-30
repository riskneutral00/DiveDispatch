// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '../../src/lib/hooks/use-debounce'

describe('useDebounce', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 500))
    expect(result.current).toBe('hello')
  })

  it('does not update before delay expires', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 300 } },
    )
    rerender({ value: 'b', delay: 300 })
    act(() => { vi.advanceTimersByTime(299) })
    expect(result.current).toBe('a')
  })

  it('updates after delay expires', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 300 } },
    )
    rerender({ value: 'b', delay: 300 })
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('b')
  })

  it('resets timer on rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 200 } },
    )
    rerender({ value: 'b', delay: 200 })
    act(() => { vi.advanceTimersByTime(100) })
    rerender({ value: 'c', delay: 200 })
    act(() => { vi.advanceTimersByTime(100) })
    // Only 100ms since last change — still 'a'
    expect(result.current).toBe('a')
    act(() => { vi.advanceTimersByTime(100) })
    // Now 200ms since last change — should be 'c', skipping 'b'
    expect(result.current).toBe('c')
  })

  it('handles zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 1, delay: 0 } },
    )
    rerender({ value: 2, delay: 0 })
    act(() => { vi.advanceTimersByTime(0) })
    expect(result.current).toBe(2)
  })

  it('works with object values', () => {
    const obj1 = { id: 1 }
    const obj2 = { id: 2 }
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: obj1, delay: 100 } },
    )
    rerender({ value: obj2, delay: 100 })
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe(obj2)
  })

  it('cleans up timeout on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { unmount } = renderHook(() => useDebounce('x', 500))
    unmount()
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })
})
