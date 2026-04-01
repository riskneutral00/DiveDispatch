import { describe, it, expect } from 'vitest'
import { getAvailableRoles } from '../available-roles'
import { ROLES, type ClerkRole } from '@/lib/constants/roles'

describe('getAvailableRoles', () => {
  it('returns all roles when user holds none', () => {
    const available = getAvailableRoles([])
    expect(available).toHaveLength(ROLES.length)
  })

  it('excludes roles the user already holds', () => {
    const held: ClerkRole[] = ['DiveCenter', 'Instructor']
    const available = getAvailableRoles(held)

    expect(available).toHaveLength(ROLES.length - 2)
    const keys = available.map((r) => r.clerkRole)
    expect(keys).not.toContain('DiveCenter')
    expect(keys).not.toContain('Instructor')
  })

  it('returns correct count when one role is held', () => {
    expect(getAvailableRoles(['DiveCenter'])).toHaveLength(ROLES.length - 1)
  })

  it('returns empty array when user holds all roles', () => {
    const allRoles = ROLES.map((r) => r.clerkRole)
    const available = getAvailableRoles(allRoles)
    expect(available).toHaveLength(0)
  })

  it('returns roles in their original display order', () => {
    const held: ClerkRole[] = ['DiveCenter']
    const available = getAvailableRoles(held)
    // Agent should still come before Instructor in the returned list
    const agentIdx = available.findIndex((r) => r.clerkRole === 'Agent')
    const instrIdx = available.findIndex((r) => r.clerkRole === 'Instructor')
    expect(agentIdx).toBeLessThan(instrIdx)
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
