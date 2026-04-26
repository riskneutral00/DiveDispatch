import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ageInYears, isAdult, MIN_SIGNUP_AGE_YEARS } from '../../convex/lib/timeConstants'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-16'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('ageInYears', () => {
  it('25-year-old → 25', () => {
    expect(ageInYears('2001-04-16')).toBe(25)
  })

  it('birthday today → exact age', () => {
    expect(ageInYears('2008-04-16')).toBe(18)
  })

  it('birthday tomorrow → age - 1', () => {
    expect(ageInYears('2008-04-17')).toBe(17)
  })

  it('birthday yesterday → already incremented', () => {
    expect(ageInYears('2008-04-15')).toBe(18)
  })

  it('invalid format → NaN', () => {
    expect(ageInYears('not-a-date')).toBeNaN()
  })

  it('empty string → NaN', () => {
    expect(ageInYears('')).toBeNaN()
  })
})

describe('isAdult', () => {
  it('exactly 18 today → true', () => {
    expect(isAdult('2008-04-16')).toBe(true)
  })

  it('17 years 364 days → false', () => {
    expect(isAdult('2008-04-17')).toBe(false)
  })

  it('25 years → true', () => {
    expect(isAdult('2001-01-01')).toBe(true)
  })

  it('future DOB → false', () => {
    expect(isAdult('2030-01-01')).toBe(false)
  })

  it('invalid → false', () => {
    expect(isAdult('garbage')).toBe(false)
  })

  it('MIN_SIGNUP_AGE_YEARS is 18', () => {
    expect(MIN_SIGNUP_AGE_YEARS).toBe(18)
  })
})
