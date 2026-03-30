import { describe, it, expect } from 'vitest'
import {
  MAX_COURSE_DAYS,
  MAX_SESSION_MINUTES,
  DEFAULT_TEXTAREA_ROWS,
  MAX_SEARCH_RESULTS,
} from '../src/lib/constants/form-config'

describe('form config constants', () => {
  it('MAX_COURSE_DAYS is a positive integer', () => {
    expect(MAX_COURSE_DAYS).toBeGreaterThan(0)
    expect(Number.isInteger(MAX_COURSE_DAYS)).toBe(true)
  })

  it('MAX_SESSION_MINUTES is a positive integer', () => {
    expect(MAX_SESSION_MINUTES).toBeGreaterThan(0)
    expect(Number.isInteger(MAX_SESSION_MINUTES)).toBe(true)
  })

  it('DEFAULT_TEXTAREA_ROWS is positive', () => {
    expect(DEFAULT_TEXTAREA_ROWS).toBeGreaterThan(0)
  })

  it('MAX_SEARCH_RESULTS is positive', () => {
    expect(MAX_SEARCH_RESULTS).toBeGreaterThan(0)
  })

  it('MAX_COURSE_DAYS is reasonable (1-30)', () => {
    expect(MAX_COURSE_DAYS).toBeGreaterThanOrEqual(1)
    expect(MAX_COURSE_DAYS).toBeLessThanOrEqual(30)
  })

  it('MAX_SESSION_MINUTES does not exceed 24 hours', () => {
    expect(MAX_SESSION_MINUTES).toBeLessThanOrEqual(24 * 60)
  })

  it('DEFAULT_TEXTAREA_ROWS is between 2 and 10', () => {
    expect(DEFAULT_TEXTAREA_ROWS).toBeGreaterThanOrEqual(2)
    expect(DEFAULT_TEXTAREA_ROWS).toBeLessThanOrEqual(10)
  })

  it('MAX_SEARCH_RESULTS is between 3 and 50', () => {
    expect(MAX_SEARCH_RESULTS).toBeGreaterThanOrEqual(3)
    expect(MAX_SEARCH_RESULTS).toBeLessThanOrEqual(50)
  })

  it('all constants are finite numbers', () => {
    for (const val of [MAX_COURSE_DAYS, MAX_SESSION_MINUTES, DEFAULT_TEXTAREA_ROWS, MAX_SEARCH_RESULTS]) {
      expect(Number.isFinite(val)).toBe(true)
    }
  })
})
