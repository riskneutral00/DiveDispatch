import { describe, it, expect } from 'vitest'
import { COURSE_CODES } from '../convex/shared/courseCodes'

describe('COURSE_CODES', () => {
  it('includes all expected course codes', () => {
    expect(COURSE_CODES).toContain('DSD')
    expect(COURSE_CODES).toContain('OW')
    expect(COURSE_CODES).toContain('AOW')
    expect(COURSE_CODES).toContain('RESCUE')
    expect(COURSE_CODES).toContain('DM')
    expect(COURSE_CODES).toContain('FD')
    expect(COURSE_CODES).toContain('REFRESH')
    expect(COURSE_CODES).toContain('SPECIALTY')
    expect(COURSE_CODES).toContain('TRY_DIVE')
  })

  it('has no duplicates', () => {
    expect(new Set(COURSE_CODES).size).toBe(COURSE_CODES.length)
  })

  it('all codes are uppercase or UPPER_SNAKE_CASE strings', () => {
    for (const code of COURSE_CODES) {
      expect(code).toMatch(/^[A-Z_]+$/)
    }
  })

  it('has exactly 9 course codes', () => {
    expect(COURSE_CODES).toHaveLength(9)
  })

  it('starts with DSD and ends with SPECIALTY', () => {
    expect(COURSE_CODES[0]).toBe('DSD')
    expect(COURSE_CODES[COURSE_CODES.length - 1]).toBe('SPECIALTY')
  })

  it('all codes are non-empty strings', () => {
    for (const code of COURSE_CODES) {
      expect(typeof code).toBe('string')
      expect(code.length).toBeGreaterThan(0)
    }
  })
})
