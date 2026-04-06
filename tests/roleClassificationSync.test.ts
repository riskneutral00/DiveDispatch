import { describe, it, expect } from 'vitest'
import { OPERATOR_ROLE_SET } from '../convex/lib/auth'
import { ORGANIZER_ROLES, RESOURCE_ROLES } from '../src/lib/constants/roles'

describe('Backend OPERATOR_ROLE_SET alignment', () => {
  it('contains exactly: DiveCenter, Agent, Liveaboard, DiveResort, DiveHostel, DiveSite', () => {
    const expected = new Set(['DiveCenter', 'Agent', 'Liveaboard', 'DiveResort', 'DiveHostel', 'DiveSite'])
    expect(OPERATOR_ROLE_SET).toEqual(expected)
  })

  it('does NOT contain pure resource roles', () => {
    const pureResourceRoles = [
      'Instructor',
      'DiveMaster',
      'Boat',
      'Equipment',
      'Pool',
      'Compressor',
    ]
    for (const role of pureResourceRoles) {
      expect(OPERATOR_ROLE_SET.has(role), `${role} should not be in OPERATOR_ROLE_SET`).toBe(false)
    }
  })

  it('ORGANIZER_ROLES plus DiveSite match OPERATOR_ROLE_SET', () => {
    const frontendOrganizerClerkRoles = new Set(ORGANIZER_ROLES.map((r) => r.clerkRole))
    // DiveSite is in both OPERATOR_ROLE_SET and RESOURCE_ROLES (dual role)
    frontendOrganizerClerkRoles.add('DiveSite')
    expect(OPERATOR_ROLE_SET).toEqual(frontendOrganizerClerkRoles)
  })

  it('has exactly 6 operator roles', () => {
    expect(OPERATOR_ROLE_SET.size).toBe(6)
  })

  it('ORGANIZER_ROLES and RESOURCE_ROLES together cover all roles', () => {
    const all = new Set([
      ...ORGANIZER_ROLES.map((r) => r.clerkRole),
      ...RESOURCE_ROLES.map((r) => r.clerkRole),
    ])
    expect(all.size).toBeGreaterThanOrEqual(OPERATOR_ROLE_SET.size)
  })

  it('RESOURCE_ROLES has at least 5 entries', () => {
    expect(RESOURCE_ROLES.length).toBeGreaterThanOrEqual(5)
  })
})
