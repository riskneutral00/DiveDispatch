import { describe, it, expect } from 'vitest'
import { getAvailableRoles } from '../src/lib/utils/available-roles'
import { ROLES, type ClerkRole } from '../src/lib/constants/roles'

describe('getAvailableRoles', () => {
  it('returns all roles when user holds none', () => {
    const available = getAvailableRoles([])
    expect(available.length).toBe(ROLES.length)
  })

  it('excludes held roles', () => {
    const held: ClerkRole[] = ['DiveCenter', 'Instructor']
    const available = getAvailableRoles(held)
    const availableClerkRoles = available.map((r) => r.clerkRole)
    expect(availableClerkRoles).not.toContain('DiveCenter')
    expect(availableClerkRoles).not.toContain('Instructor')
  })

  it('returns correct count when one role is held', () => {
    const available = getAvailableRoles(['DiveCenter'])
    expect(available.length).toBe(ROLES.length - 1)
  })

  it('returns empty array when all roles are held', () => {
    const allRoles = ROLES.map((r) => r.clerkRole)
    const available = getAvailableRoles(allRoles)
    expect(available).toEqual([])
  })

  it('preserves role config structure', () => {
    const available = getAvailableRoles(['DiveCenter'])
    for (const role of available) {
      expect(role).toHaveProperty('key')
      expect(role).toHaveProperty('clerkRole')
      expect(role).toHaveProperty('label')
      expect(role).toHaveProperty('isOrganizer')
    }
  })

  it('returns original ROLES objects (not copies)', () => {
    const available = getAvailableRoles(['DiveCenter'])
    const agentFromRoles = ROLES.find((r) => r.clerkRole === 'Agent')
    const agentFromAvailable = available.find((r) => r.clerkRole === 'Agent')
    expect(agentFromAvailable).toBe(agentFromRoles)
  })
})
