import { describe, it, expect } from 'vitest'
import {
  HOUR_MS,
  DAY_MS,
  BOOKING_LINK_TTL_MS,
  NOSHOW_REVERT_WINDOW_MS,
  MEDICAL_TTL_MS,
} from './timeConstants'

describe('timeConstants — base units', () => {
  it('HOUR_MS is 3600000', () => {
    expect(HOUR_MS).toBe(60 * 60 * 1000)
  })

  it('DAY_MS is 24 * HOUR_MS', () => {
    expect(DAY_MS).toBe(24 * HOUR_MS)
  })
})

describe('timeConstants — TTL values', () => {
  it('BOOKING_LINK_TTL_MS is 30 days', () => {
    expect(BOOKING_LINK_TTL_MS).toBe(30 * DAY_MS)
  })

  it('NOSHOW_REVERT_WINDOW_MS is 24 hours', () => {
    expect(NOSHOW_REVERT_WINDOW_MS).toBe(24 * HOUR_MS)
  })

  it('MEDICAL_TTL_MS is 36 hours', () => {
    expect(MEDICAL_TTL_MS).toBe(36 * HOUR_MS)
  })
})
