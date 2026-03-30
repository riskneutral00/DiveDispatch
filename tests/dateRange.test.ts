import { describe, it, expect } from 'vitest'
import { getDatesInRange, parseDateLocal } from '../convex/shared/dateRange'

describe('getDatesInRange', () => {
  it('returns inclusive range of dates', () => {
    const result = getDatesInRange('2026-03-01', '2026-03-03')
    expect(result).toEqual(['2026-03-01', '2026-03-02', '2026-03-03'])
  })

  it('returns single date when start equals end', () => {
    expect(getDatesInRange('2026-06-15', '2026-06-15')).toEqual(['2026-06-15'])
  })

  it('returns empty array when start is after end', () => {
    expect(getDatesInRange('2026-03-05', '2026-03-01')).toEqual([])
  })

  it('returns empty array for empty startDate', () => {
    expect(getDatesInRange('', '2026-03-01')).toEqual([])
  })

  it('returns empty array for empty endDate', () => {
    expect(getDatesInRange('2026-03-01', '')).toEqual([])
  })

  it('returns empty array for invalid startDate', () => {
    expect(getDatesInRange('not-a-date', '2026-03-01')).toEqual([])
  })

  it('returns empty array for invalid endDate', () => {
    expect(getDatesInRange('2026-03-01', 'garbage')).toEqual([])
  })

  it('pads single-digit months and days with leading zeros', () => {
    const result = getDatesInRange('2026-01-08', '2026-01-10')
    expect(result).toEqual(['2026-01-08', '2026-01-09', '2026-01-10'])
  })

  it('handles month boundary crossing', () => {
    const result = getDatesInRange('2026-01-30', '2026-02-02')
    expect(result).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'])
  })

  it('handles year boundary crossing', () => {
    const result = getDatesInRange('2025-12-30', '2026-01-02')
    expect(result).toEqual(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'])
  })

  it('handles leap year Feb 29', () => {
    const result = getDatesInRange('2028-02-28', '2028-03-01')
    expect(result).toEqual(['2028-02-28', '2028-02-29', '2028-03-01'])
  })

  it('handles non-leap year Feb boundary', () => {
    const result = getDatesInRange('2026-02-27', '2026-03-01')
    expect(result).toEqual(['2026-02-27', '2026-02-28', '2026-03-01'])
  })
})

describe('parseDateLocal', () => {
  it('parses ISO date string to local midnight', () => {
    const date = parseDateLocal('2026-03-15')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2) // 0-indexed
    expect(date.getDate()).toBe(15)
    expect(date.getHours()).toBe(0)
    expect(date.getMinutes()).toBe(0)
  })

  it('avoids UTC shift for single-digit day', () => {
    const date = parseDateLocal('2026-01-01')
    expect(date.getDate()).toBe(1)
    expect(date.getMonth()).toBe(0)
  })

  it('handles end of year', () => {
    const date = parseDateLocal('2026-12-31')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(11)
    expect(date.getDate()).toBe(31)
  })
})
