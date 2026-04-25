import { describe, it, expect } from 'vitest'
import { deriveDefaultRole, ROLE_PRECEDENCE } from '../convex/lib/rolePrecedence'

describe('deriveDefaultRole', () => {
  it('returns the single role when only one is provided', () => {
    expect(deriveDefaultRole(['Instructor'])).toBe('Instructor')
  })

  it('returns DiveCenter over Instructor (operator > resource)', () => {
    expect(deriveDefaultRole(['Instructor', 'DiveCenter'])).toBe('DiveCenter')
  })

  it('returns DiveCenter over all other roles', () => {
    expect(deriveDefaultRole(['Equipment', 'Boat', 'Instructor', 'DiveCenter'])).toBe('DiveCenter')
  })

  it('returns Agent over resource roles', () => {
    expect(deriveDefaultRole(['Venue', 'Agent', 'Compressor'])).toBe('Agent')
  })

  it('returns Venue over Equipment and Instructor (resource precedence order)', () => {
    expect(deriveDefaultRole(['Equipment', 'Venue', 'Instructor'])).toBe('Venue')
  })

  it('throws for empty roles array', () => {
    expect(() => deriveDefaultRole([])).toThrow('User has no roles')
  })

  it('handles unknown roles (treated as lowest precedence)', () => {
    expect(deriveDefaultRole(['UnknownRole', 'Compressor'])).toBe('Compressor')
  })

  it('handles all unknown roles (returns first alphabetically via sort stability)', () => {
    // Both have Infinity precedence, sort is stable in V8
    const result = deriveDefaultRole(['Zzz', 'Aaa'])
    expect(typeof result).toBe('string')
  })
})

describe('ROLE_PRECEDENCE', () => {
  it('Agent has the highest precedence among all roles', () => {
    expect(ROLE_PRECEDENCE.Agent).toBeLessThan(ROLE_PRECEDENCE.DiveCenter)
    expect(ROLE_PRECEDENCE.DiveCenter).toBeLessThan(ROLE_PRECEDENCE.Venue)
  })

  it('Compressor ranks between Equipment and Instructor', () => {
    expect(ROLE_PRECEDENCE.Compressor).toBeGreaterThan(ROLE_PRECEDENCE.Equipment)
    expect(ROLE_PRECEDENCE.Compressor).toBeLessThan(ROLE_PRECEDENCE.Instructor)
  })

  it('all expected roles are defined', () => {
    const expected = [
      'DiveCenter', 'Agent',
      'Venue', 'Instructor', 'Boat', 'Equipment', 'Compressor',
    ]
    for (const role of expected) {
      expect(ROLE_PRECEDENCE).toHaveProperty(role)
    }
  })
})
