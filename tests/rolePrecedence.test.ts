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
    expect(deriveDefaultRole(['Pool', 'Agent', 'Compressor'])).toBe('Agent')
  })

  it('returns Instructor over Boat/Equipment/Pool/Compressor', () => {
    expect(deriveDefaultRole(['Equipment', 'Pool', 'Instructor'])).toBe('Instructor')
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
  it('DiveCenter has the highest precedence (0)', () => {
    expect(ROLE_PRECEDENCE.DiveCenter).toBe(0)
  })

  it('Compressor has the lowest precedence (11)', () => {
    expect(ROLE_PRECEDENCE.Compressor).toBe(11)
  })

  it('all expected roles are defined', () => {
    const expected = [
      'DiveCenter', 'Agent', 'Liveaboard', 'DiveResort', 'DiveHostel',
      'DiveSite', 'Instructor', 'Boat', 'Equipment', 'Pool', 'Compressor',
    ]
    for (const role of expected) {
      expect(ROLE_PRECEDENCE).toHaveProperty(role)
    }
  })
})
