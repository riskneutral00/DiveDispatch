import { describe, it, expect } from 'vitest'
import {
  BAR_ROW_HEIGHT,
  MAX_VISIBLE_BOOKINGS_PER_DAY,
  DAY_CELL_PILLS_MAX_HEIGHT,
} from '../src/lib/constants/calendar-config'

describe('calendar config constants', () => {
  it('BAR_ROW_HEIGHT is a positive integer', () => {
    expect(BAR_ROW_HEIGHT).toBeGreaterThan(0)
    expect(Number.isInteger(BAR_ROW_HEIGHT)).toBe(true)
  })

  it('MAX_VISIBLE_BOOKINGS_PER_DAY is a positive integer', () => {
    expect(MAX_VISIBLE_BOOKINGS_PER_DAY).toBeGreaterThan(0)
    expect(Number.isInteger(MAX_VISIBLE_BOOKINGS_PER_DAY)).toBe(true)
  })

  it('DAY_CELL_PILLS_MAX_HEIGHT equals MAX_VISIBLE * BAR_ROW_HEIGHT', () => {
    expect(DAY_CELL_PILLS_MAX_HEIGHT).toBe(MAX_VISIBLE_BOOKINGS_PER_DAY * BAR_ROW_HEIGHT)
  })

  it('BAR_ROW_HEIGHT is a reasonable touch target height (20-60px)', () => {
    expect(BAR_ROW_HEIGHT).toBeGreaterThanOrEqual(20)
    expect(BAR_ROW_HEIGHT).toBeLessThanOrEqual(60)
  })
})
