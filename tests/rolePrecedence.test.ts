/**
 * rolePrecedence — Unit Tests
 *
 * Tests deriveDefaultRole: given a set of assigned roles,
 * returns the highest-precedence role for default routing.
 */

import { describe, it, expect } from 'vitest'
import { deriveDefaultRole, ROLE_PRECEDENCE } from '../convex/lib/rolePrecedence'

describe('ROLE_PRECEDENCE', () => {
  it('contains all 12 stakeholder roles', () => {
    expect(Object.keys(ROLE_PRECEDENCE)).toHaveLength(12)
  })

  it('ranks DiveCenter highest (0)', () => {
    expect(ROLE_PRECEDENCE['DiveCenter']).toBe(0)
  })

  it('ranks Compressor lowest (11)', () => {
    expect(ROLE_PRECEDENCE['Compressor']).toBe(11)
  })

  it('ranks operators before resources', () => {
    const operators = ['DiveCenter', 'Agent', 'Liveaboard', 'DiveResort', 'DiveHostel']
    const resources = ['Instructor', 'DiveMaster', 'Boat', 'Equipment', 'Pool', 'Compressor']
    const maxOperator = Math.max(...operators.map((r) => ROLE_PRECEDENCE[r]))
    const minResource = Math.min(...resources.map((r) => ROLE_PRECEDENCE[r]))
    // DiveSite sits between operators and resources
    expect(maxOperator).toBeLessThan(minResource)
  })
})

describe('deriveDefaultRole', () => {
  it('returns the single role when only one is held', () => {
    expect(deriveDefaultRole(['Instructor'])).toBe('Instructor')
  })

  it('returns DiveCenter over Instructor', () => {
    expect(deriveDefaultRole(['Instructor', 'DiveCenter'])).toBe('DiveCenter')
  })

  it('returns DiveCenter over Agent', () => {
    expect(deriveDefaultRole(['Agent', 'DiveCenter'])).toBe('DiveCenter')
  })

  it('returns Instructor over DiveMaster', () => {
    expect(deriveDefaultRole(['DiveMaster', 'Instructor'])).toBe('Instructor')
  })

  it('returns Boat over Equipment and Pool', () => {
    expect(deriveDefaultRole(['Equipment', 'Pool', 'Boat'])).toBe('Boat')
  })

  it('returns DiveCenter when holding operator + resource roles', () => {
    expect(
      deriveDefaultRole(['Instructor', 'Boat', 'DiveCenter', 'Equipment']),
    ).toBe('DiveCenter')
  })

  it('returns Agent when holding Agent + resources (no DiveCenter)', () => {
    expect(
      deriveDefaultRole(['Instructor', 'Agent', 'Equipment']),
    ).toBe('Agent')
  })

  it('is not affected by input order', () => {
    const roles = ['Compressor', 'Instructor', 'Agent', 'DiveCenter']
    const reversed = [...roles].reverse()
    expect(deriveDefaultRole(roles)).toBe(deriveDefaultRole(reversed))
  })

  it('throws when given an empty array', () => {
    expect(() => deriveDefaultRole([])).toThrow()
  })

  it('does not mutate the input array', () => {
    const roles = ['Instructor', 'DiveCenter', 'Agent']
    const copy = [...roles]
    deriveDefaultRole(roles)
    expect(roles).toEqual(copy)
  })
})
