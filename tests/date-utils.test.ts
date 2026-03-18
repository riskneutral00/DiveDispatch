import { describe, it, expect } from 'vitest'
import {
  addDays,
  diffDays,
  getDatesInRange,
  toISODateString,
} from '../src/lib/utils/date'

describe('addDays', () => {
  it('adds positive days', () => {
    expect(addDays('2026-03-15', 3)).toBe('2026-03-18')
  })

  it('adds zero days (identity)', () => {
    expect(addDays('2026-03-15', 0)).toBe('2026-03-15')
  })

  it('crosses month boundary', () => {
    expect(addDays('2026-03-30', 3)).toBe('2026-04-02')
  })

  it('crosses year boundary', () => {
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04')
  })

  it('handles negative days', () => {
    expect(addDays('2026-03-15', -2)).toBe('2026-03-13')
  })
})

describe('diffDays', () => {
  it('returns positive diff when a > b', () => {
    expect(diffDays('2026-03-18', '2026-03-15')).toBe(3)
  })

  it('returns 0 for same date', () => {
    expect(diffDays('2026-03-15', '2026-03-15')).toBe(0)
  })

  it('returns negative diff when a < b', () => {
    expect(diffDays('2026-03-15', '2026-03-18')).toBe(-3)
  })

  it('crosses month boundary', () => {
    expect(diffDays('2026-04-02', '2026-03-30')).toBe(3)
  })
})

describe('getDatesInRange', () => {
  it('returns inclusive range', () => {
    expect(getDatesInRange('2026-03-15', '2026-03-18')).toEqual([
      '2026-03-15',
      '2026-03-16',
      '2026-03-17',
      '2026-03-18',
    ])
  })

  it('returns single date when start === end', () => {
    expect(getDatesInRange('2026-03-15', '2026-03-15')).toEqual(['2026-03-15'])
  })

  it('returns empty array when start > end', () => {
    expect(getDatesInRange('2026-03-18', '2026-03-15')).toEqual([])
  })

  it('returns empty array for empty strings', () => {
    expect(getDatesInRange('', '')).toEqual([])
  })

  it('crosses month boundary', () => {
    const result = getDatesInRange('2026-03-30', '2026-04-01')
    expect(result).toEqual(['2026-03-30', '2026-03-31', '2026-04-01'])
  })
})

describe('toISODateString', () => {
  it('formats a Date to YYYY-MM-DD', () => {
    expect(toISODateString(new Date(2026, 2, 15))).toBe('2026-03-15')
  })

  it('zero-pads single-digit months', () => {
    expect(toISODateString(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
