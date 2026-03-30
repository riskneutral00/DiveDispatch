import { describe, it, expect } from 'vitest'
import {
  validateRatio,
  PRIMARY_INSTRUCTOR_MAX,
  HELPER_DM_RATIO,
  HELPER_INSTRUCTOR_RATIO,
  BOOKING_MAX_CUSTOMERS,
} from '../convex/shared/ratioRules'

// ── Constants ────────────────────────────────────────────────────────────────

describe('ratio constants', () => {
  it('primary instructor max is 4', () => {
    expect(PRIMARY_INSTRUCTOR_MAX).toBe(4)
  })

  it('helper DM ratio is 1:2', () => {
    expect(HELPER_DM_RATIO).toBe(2)
  })

  it('helper instructor ratio is 1:4', () => {
    expect(HELPER_INSTRUCTOR_RATIO).toBe(4)
  })

  it('booking max customers is 12', () => {
    expect(BOOKING_MAX_CUSTOMERS).toBe(12)
  })
})

// ── Acceptance criteria from ticket ─────────────────────────────────────────

describe('validateRatio — acceptance criteria', () => {
  it('4 divers + 1 instructor → allowed', () => {
    const result = validateRatio(4, 1, 0)
    expect(result.valid).toBe(true)
    expect(result.message).toBeUndefined()
  })

  it('5 divers + 1 instructor → blocked', () => {
    const result = validateRatio(5, 1, 0)
    expect(result.valid).toBe(false)
    expect(result.message).toContain('exceeds staff capacity')
  })

  it('5 divers + 1 instructor + 1 DM → allowed (DM covers 2 extra)', () => {
    const result = validateRatio(5, 1, 1)
    expect(result.valid).toBe(true)
    expect(result.message).toBeUndefined()
  })

  it('8 divers + 2 instructors → allowed (4 each)', () => {
    const result = validateRatio(8, 2, 0)
    expect(result.valid).toBe(true)
    expect(result.message).toBeUndefined()
  })

  it('13 divers → blocked regardless of instructor count (max 12)', () => {
    const result = validateRatio(13, 5, 5)
    expect(result.valid).toBe(false)
    expect(result.message).toContain('Maximum 12 customers per booking')
  })
})

// ── Boundary cases ──────────────────────────────────────────────────────────

describe('validateRatio — boundary cases', () => {
  it('0 divers is always valid', () => {
    const result = validateRatio(0, 0, 0)
    expect(result.valid).toBe(true)
  })

  it('1 diver + 0 instructors → blocked (need at least 1)', () => {
    const result = validateRatio(1, 0, 0)
    expect(result.valid).toBe(false)
    expect(result.message).toContain('At least 1 instructor is required')
  })

  it('exact boundary: 4 divers + 1 instructor = exactly at capacity', () => {
    const result = validateRatio(4, 1, 0)
    expect(result.valid).toBe(true)
  })

  it('one over boundary: 5 divers + 1 instructor = over capacity', () => {
    const result = validateRatio(5, 1, 0)
    expect(result.valid).toBe(false)
  })

  it('6 divers + 1 instructor + 1 DM → allowed (4 + 2 = 6)', () => {
    const result = validateRatio(6, 1, 1)
    expect(result.valid).toBe(true)
  })

  it('7 divers + 1 instructor + 1 DM → blocked (capacity 6)', () => {
    const result = validateRatio(7, 1, 1)
    expect(result.valid).toBe(false)
  })

  it('12 divers + 3 instructors → allowed (4 + 4 + 4 = 12)', () => {
    const result = validateRatio(12, 3, 0)
    expect(result.valid).toBe(true)
  })

  it('max 12 check fires before ratio check', () => {
    // 13 divers should fail with max-customers message, not ratio message
    const result = validateRatio(13, 10, 10)
    expect(result.valid).toBe(false)
    expect(result.message).toContain('Maximum 12 customers per booking')
  })

  it('10 divers + 1 instructor + 3 DMs → allowed (4 + 6 = 10)', () => {
    const result = validateRatio(10, 1, 3)
    expect(result.valid).toBe(true)
  })

  it('11 divers + 1 instructor + 3 DMs → blocked (capacity 10)', () => {
    const result = validateRatio(11, 1, 3)
    expect(result.valid).toBe(false)
  })

  it('mixed helpers: 10 divers + 2 instructors + 1 DM → allowed (4 + 4 + 2 = 10)', () => {
    const result = validateRatio(10, 2, 1)
    expect(result.valid).toBe(true)
  })

  it('1 diver + 1 instructor → allowed (well within limits)', () => {
    const result = validateRatio(1, 1, 0)
    expect(result.valid).toBe(true)
  })
})
