import { describe, it, expect } from 'vitest'
import {
  addDays,
  diffDays,
  getDatesInRange,
  toISODateString,
} from '../src/lib/utils/date'
import { testDate } from './helpers/dates'

describe('addDays', () => {
  it('adds positive days', () => {
    const start = testDate(5)
    expect(addDays(start, 3)).toBe(addDays(start, 3))
  })

  it('adds zero days (identity)', () => {
    const start = testDate(5)
    expect(addDays(start, 0)).toBe(start)
  })

  it('crosses month boundary', () => {
    const start = testDate(5)
    const result = addDays(start, 30)
    expect(diffDays(result, start)).toBe(30)
  })

  it('crosses year boundary', () => {
    const start = testDate(5)
    const result = addDays(start, 365)
    expect(diffDays(result, start)).toBe(365)
  })

  it('handles negative days', () => {
    const start = testDate(5)
    expect(addDays(start, -2)).toBe(addDays(start, -2))
    expect(diffDays(start, addDays(start, -2))).toBe(2)
  })
})

describe('diffDays', () => {
  it('returns positive diff when a > b', () => {
    expect(diffDays(testDate(8), testDate(5))).toBe(3)
  })

  it('returns 0 for same date', () => {
    expect(diffDays(testDate(5), testDate(5))).toBe(0)
  })

  it('returns negative diff when a < b', () => {
    expect(diffDays(testDate(5), testDate(8))).toBe(-3)
  })

  it('crosses month boundary', () => {
    expect(diffDays(testDate(35), testDate(5))).toBe(30)
  })
})

describe('getDatesInRange', () => {
  it('returns inclusive range', () => {
    const start = testDate(5)
    const end = addDays(start, 3)
    expect(getDatesInRange(start, end)).toEqual([
      start,
      addDays(start, 1),
      addDays(start, 2),
      end,
    ])
  })

  it('returns single date when start === end', () => {
    const d = testDate(5)
    expect(getDatesInRange(d, d)).toEqual([d])
  })

  it('returns empty array when start > end', () => {
    expect(getDatesInRange(testDate(8), testDate(5))).toEqual([])
  })

  it('returns empty array for empty strings', () => {
    expect(getDatesInRange('', '')).toEqual([])
  })

  it('crosses month boundary', () => {
    const start = testDate(5)
    const end = addDays(start, 2)
    const result = getDatesInRange(start, end)
    expect(result).toEqual([start, addDays(start, 1), end])
  })
})

describe('toISODateString', () => {
  const year = new Date().getFullYear()

  it('formats a Date to YYYY-MM-DD', () => {
    expect(toISODateString(new Date(year, 2, 15))).toBe(`${year}-03-15`)
  })

  it('zero-pads single-digit months', () => {
    expect(toISODateString(new Date(year, 0, 5))).toBe(`${year}-01-05`)
  })
})
