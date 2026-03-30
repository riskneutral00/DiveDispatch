import { describe, it, expect } from 'vitest'
import { getAvailableRoles } from '../../src/lib/utils/available-roles'
import { ROLES, type ClerkRole } from '../../src/lib/constants/roles'

describe('getAvailableRoles', () => {
  it('returns all roles when user holds none', () => {
    const available = getAvailableRoles([])
    expect(available).toHaveLength(ROLES.length)
  })

  it('excludes held roles', () => {
    const available = getAvailableRoles(['Instructor', 'DiveCenter'])
    const availableClerks = available.map((r) => r.clerkRole)
    expect(availableClerks).not.toContain('Instructor')
    expect(availableClerks).not.toContain('DiveCenter')
    expect(available.length).toBe(ROLES.length - 2)
  })

  it('returns empty when user holds all roles', () => {
    const allRoles = ROLES.map((r) => r.clerkRole) as ClerkRole[]
    expect(getAvailableRoles(allRoles)).toEqual([])
  })

  it('preserves role order from ROLES constant', () => {
    const available = getAvailableRoles(['Instructor'])
    const allNonInstructor = ROLES.filter((r) => r.clerkRole !== 'Instructor')
    expect(available.map((r) => r.key)).toEqual(allNonInstructor.map((r) => r.key))
  })
})
