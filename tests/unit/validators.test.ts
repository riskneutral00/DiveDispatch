import { describe, it, expect } from 'vitest'
import { effectiveResourceType, TIME_REGEX, normalizeTime, assertValidTime } from '../../convex/lib/validators'
import { RESOURCE_OWNER_TYPES } from '../../convex/shared/resourceOwnerTypes'

describe('effectiveResourceType', () => {
  it('returns null for DiveMaster post-collapse (not a user role)', () => {
    expect(effectiveResourceType('DiveMaster')).toBeNull()
  })

  it('passes through all RESOURCE_OWNER_TYPES as-is', () => {
    for (const type of RESOURCE_OWNER_TYPES) {
      expect(effectiveResourceType(type)).toBe(type)
    }
  })

  it('returns null for DiveCenter (operator, not resource)', () => {
    expect(effectiveResourceType('DiveCenter')).toBeNull()
  })

  it('returns null for Agent (operator, not resource)', () => {
    expect(effectiveResourceType('Agent')).toBeNull()
  })

  it('returns null for unknown role', () => {
    expect(effectiveResourceType('UnknownRole')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(effectiveResourceType('')).toBeNull()
  })
})

describe('TIME_REGEX edge cases', () => {
  it('rejects single-digit hour', () => {
    expect(TIME_REGEX.test('8:00')).toBe(false)
  })

  it('rejects single-digit minute', () => {
    expect(TIME_REGEX.test('08:0')).toBe(false)
  })

  it('rejects letters', () => {
    expect(TIME_REGEX.test('ab:cd')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(TIME_REGEX.test('')).toBe(false)
  })

  it('accepts 00:00', () => {
    expect(TIME_REGEX.test('00:00')).toBe(true)
  })

  it('accepts 23:59', () => {
    expect(TIME_REGEX.test('23:59')).toBe(true)
  })
})

describe('normalizeTime edge cases', () => {
  it('normalizes 8:0 to 08:00', () => {
    expect(normalizeTime('8:0')).toBe('08:00')
  })

  it('normalizes 0:5 to 00:05', () => {
    expect(normalizeTime('0:5')).toBe('00:05')
  })
})

describe('assertValidTime', () => {
  it('throws for invalid format with field name', () => {
    expect(() => assertValidTime('invalid', 'startTime')).toThrow()
  })

  it('does not throw for valid format', () => {
    expect(() => assertValidTime('08:00', 'startTime')).not.toThrow()
  })
})
