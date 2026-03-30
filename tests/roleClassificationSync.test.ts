import { describe, it, expect } from 'vitest'
import { OPERATOR_ROLE_SET } from '../convex/lib/auth'
import { ORGANIZER_ROLES, RESOURCE_ROLES } from '../src/lib/constants/roles'

describe('Backend OPERATOR_ROLE_SET alignment', () => {
  it('contains exactly: DiveCenter, Agent, Liveaboard, DiveResort, DiveHostel', () => {
    const expected = new Set(['DiveCenter', 'Agent', 'Liveaboard', 'DiveResort', 'DiveHostel'])
    expect(OPERATOR_ROLE_SET).toEqual(expected)
  })

  it('does NOT contain any resource roles', () => {
    const resourceClerkRoles = [
      'DiveSite',
      'Instructor',
      'DiveMaster',
      'Boat',
      'Equipment',
      'Pool',
      'Compressor',
    ]
    for (const role of resourceClerkRoles) {
      expect(OPERATOR_ROLE_SET.has(role), `${role} should not be in OPERATOR_ROLE_SET`).toBe(false)
    }
  })

  it('members match ORGANIZER_ROLES from roles.ts (cross-file sync)', () => {
    const frontendOrganizerClerkRoles = new Set(ORGANIZER_ROLES.map((r) => r.clerkRole))
    expect(OPERATOR_ROLE_SET).toEqual(frontendOrganizerClerkRoles)
  })

  it('does not overlap with RESOURCE_ROLES', () => {
    for (const role of RESOURCE_ROLES) {
      expect(
        OPERATOR_ROLE_SET.has(role.clerkRole),
        `${role.clerkRole} is in RESOURCE_ROLES but also in OPERATOR_ROLE_SET`,
      ).toBe(false)
    }
  })

  it('has exactly 5 operator roles', () => {
    expect(OPERATOR_ROLE_SET.size).toBe(5)
  })

  it('ORGANIZER_ROLES and RESOURCE_ROLES together cover all roles', () => {
    const all = new Set([
      ...ORGANIZER_ROLES.map((r) => r.clerkRole),
      ...RESOURCE_ROLES.map((r) => r.clerkRole),
    ])
    // At minimum, all operator + resource roles exist
    expect(all.size).toBeGreaterThanOrEqual(OPERATOR_ROLE_SET.size + RESOURCE_ROLES.length)
  })

  it('RESOURCE_ROLES has at least 5 entries', () => {
    expect(RESOURCE_ROLES.length).toBeGreaterThanOrEqual(5)
  })
})
