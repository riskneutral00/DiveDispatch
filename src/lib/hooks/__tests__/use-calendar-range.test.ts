// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCalendarRange } from '../use-calendar-range'

describe('useCalendarRange', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with a default range', () => {
    const { result } = renderHook(() => useCalendarRange())
    expect(result.current.range.start).toBeInstanceOf(Date)
    expect(result.current.range.end).toBeInstanceOf(Date)
    expect(result.current.range.end > result.current.range.start).toBe(true)
  })

  it('weeks is a non-empty array of 7-day weeks', () => {
    const { result } = renderHook(() => useCalendarRange())
    expect(result.current.weeks.length).toBeGreaterThan(0)
    for (const week of result.current.weeks) {
      expect(week).toHaveLength(7)
    }
  })

  it('shiftRange moves the range forward', () => {
    const { result } = renderHook(() => useCalendarRange())
    const startBefore = result.current.range.start.getTime()
    act(() => {
      result.current.shiftRange(1)
    })
    expect(result.current.range.start.getTime()).toBeGreaterThan(startBefore)
  })

  it('jumpToDate centers range around the given date', () => {
    const { result } = renderHook(() => useCalendarRange())
    const futureDate = new Date('2027-06-15')
    act(() => {
      result.current.jumpToDate(futureDate)
    })
    expect(result.current.range.start <= futureDate).toBe(true)
    expect(result.current.range.end >= futureDate).toBe(true)
  })

  it('resetRange returns to default window', () => {
    const { result } = renderHook(() => useCalendarRange())
    const initialStart = result.current.range.start.getTime()
    act(() => {
      result.current.shiftRange(5)
    })
    act(() => {
      result.current.resetRange()
    })
    const diff = Math.abs(result.current.range.start.getTime() - initialStart)
    expect(diff).toBeLessThan(24 * 60 * 60 * 1000)
  })
})
