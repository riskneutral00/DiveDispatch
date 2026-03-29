import { describe, it, expect } from 'vitest'
import { assertValidTime, normalizeTime, TIME_REGEX } from './validators'

describe('TIME_REGEX', () => {
  it('matches two-digit hours and minutes', () => {
    expect(TIME_REGEX.test('09:00')).toBe(true)
    expect(TIME_REGEX.test('14:30')).toBe(true)
    expect(TIME_REGEX.test('00:00')).toBe(true)
    expect(TIME_REGEX.test('23:59')).toBe(true)
  })

  it.each(['9:00', '09:0', '0900', '09:00:00', ' 09:00'])(
    'rejects invalid format %j',
    (input) => {
      expect(TIME_REGEX.test(input)).toBe(false)
    },
  )
})

describe('assertValidTime', () => {
  it('passes for valid HH:MM format', () => {
    expect(() => assertValidTime('09:00', 'startTime')).not.toThrow()
    expect(() => assertValidTime('14:30', 'startTime')).not.toThrow()
  })

  it.each([
    ['9:00', 'startTime'],
    ['09:0', 'endTime'],
  ])('throws VALIDATION error for %j with field %j', (time, field) => {
    expect(() => assertValidTime(time, field)).toThrow(
      `${field} must be HH:MM format`,
    )
  })

  it('includes the field name in the error message', () => {
    expect(() => assertValidTime('9:00', 'windowStart')).toThrow(
      'windowStart must be HH:MM format',
    )
  })
})

describe('normalizeTime', () => {
  it('pads single-digit hour', () => {
    expect(normalizeTime('9:00')).toBe('09:00')
  })

  it('pads single-digit minute', () => {
    expect(normalizeTime('09:5')).toBe('09:05')
  })

  it('pads both single-digit hour and minute', () => {
    expect(normalizeTime('9:5')).toBe('09:05')
  })

  it('is idempotent for already-valid format', () => {
    expect(normalizeTime('09:00')).toBe('09:00')
    expect(normalizeTime('14:30')).toBe('14:30')
  })
})
