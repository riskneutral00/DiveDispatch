import { describe, it, expect } from 'vitest'
import {
  HOUR_MS,
  DAY_MS,
  BOOKING_LINK_TTL_MS,
  NOSHOW_REVERT_WINDOW_MS,
  MEDICAL_TTL_MS,
} from '../convex/lib/timeConstants'
import { HOLD_TTL_MS } from '../convex/lib/auth'

describe('time constants', () => {
  it('HOUR_MS is 3600000', () => {
    expect(HOUR_MS).toBe(60 * 60 * 1000)
  })

  it('DAY_MS is 86400000', () => {
    expect(DAY_MS).toBe(24 * 60 * 60 * 1000)
  })

  it('DAY_MS equals 24 * HOUR_MS', () => {
    expect(DAY_MS).toBe(24 * HOUR_MS)
  })

  it('BOOKING_LINK_TTL_MS is 30 days', () => {
    expect(BOOKING_LINK_TTL_MS).toBe(30 * DAY_MS)
  })

  it('NOSHOW_REVERT_WINDOW_MS is 24 hours', () => {
    expect(NOSHOW_REVERT_WINDOW_MS).toBe(24 * HOUR_MS)
  })

  it('MEDICAL_TTL_MS is 36 hours', () => {
    expect(MEDICAL_TTL_MS).toBe(36 * HOUR_MS)
  })

  it('HOLD_TTL_MS is 12 hours (43200000)', () => {
    expect(HOLD_TTL_MS).toBe(12 * HOUR_MS)
  })

  it('MEDICAL_TTL_MS > HOLD_TTL_MS (medical block holds longer)', () => {
    expect(MEDICAL_TTL_MS).toBeGreaterThan(HOLD_TTL_MS)
  })

  it('BOOKING_LINK_TTL_MS > NOSHOW_REVERT_WINDOW_MS', () => {
    expect(BOOKING_LINK_TTL_MS).toBeGreaterThan(NOSHOW_REVERT_WINDOW_MS)
  })
})
