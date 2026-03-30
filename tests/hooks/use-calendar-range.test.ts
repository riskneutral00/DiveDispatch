// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCalendarRange } from '../../src/lib/hooks/use-calendar-range'

describe('useCalendarRange', () => {
  afterEach(() => { vi.restoreAllMocks() })

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

  it('headerLabel is a string', () => {
    const { result } = renderHook(() => useCalendarRange())
    expect(typeof result.current.headerLabel).toBe('string')
    expect(result.current.headerLabel.length).toBeGreaterThan(0)
  })

  it('shiftRange moves the range forward', () => {
    const { result } = renderHook(() => useCalendarRange())
    const startBefore = result.current.range.start.getTime()
    act(() => { result.current.shiftRange(1) })
    expect(result.current.range.start.getTime()).toBeGreaterThan(startBefore)
  })

  it('shiftRange moves the range backward', () => {
    const { result } = renderHook(() => useCalendarRange())
    // First shift forward to have room
    act(() => { result.current.shiftRange(2) })
    const startBefore = result.current.range.start.getTime()
    act(() => { result.current.shiftRange(-1) })
    expect(result.current.range.start.getTime()).toBeLessThan(startBefore)
  })

  it('jumpToDate centers range around the given date', () => {
    const { result } = renderHook(() => useCalendarRange())
    const futureDate = new Date('2027-06-15')
    act(() => { result.current.jumpToDate(futureDate) })
    // The range should contain the target date
    expect(result.current.range.start <= futureDate).toBe(true)
    expect(result.current.range.end >= futureDate).toBe(true)
  })

  it('resetRange returns to default', () => {
    const { result } = renderHook(() => useCalendarRange())
    const initialStart = result.current.range.start.getTime()
    act(() => { result.current.shiftRange(5) })
    expect(result.current.range.start.getTime()).not.toBe(initialStart)
    act(() => { result.current.resetRange() })
    // Should be approximately back to initial (within a day tolerance due to default calc)
    const diff = Math.abs(result.current.range.start.getTime() - initialStart)
    expect(diff).toBeLessThan(24 * 60 * 60 * 1000)
  })

  it('todayCol is a number >= -1', () => {
    const { result } = renderHook(() => useCalendarRange())
    expect(typeof result.current.todayCol).toBe('number')
    expect(result.current.todayCol).toBeGreaterThanOrEqual(-1)
    expect(result.current.todayCol).toBeLessThan(7)
  })

  it('setRange updates the range directly', () => {
    const { result } = renderHook(() => useCalendarRange())
    const newRange = {
      start: new Date('2027-01-01'),
      end: new Date('2027-01-28'),
    }
    act(() => { result.current.setRange(newRange) })
    expect(result.current.range.start.getTime()).toBe(newRange.start.getTime())
    expect(result.current.range.end.getTime()).toBe(newRange.end.getTime())
  })
})
