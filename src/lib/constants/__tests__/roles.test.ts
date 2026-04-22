import { describe, it, expect } from 'vitest'
import {
  ROLES,
  ROLE_BY_KEY,
  ROLE_BY_CLERK_ROLE,
  ORGANIZER_ROLES,
  RESOURCE_ROLES,
  DISPLAY_OPERATOR_ROLES,
  DISPLAY_RESOURCE_ROLES,
  type RoleKey,
  type ClerkRole,
} from '../roles'

describe('Binary role classification', () => {
  it('every role is exactly one of isOrganizer or isResource (XOR)', () => {
    for (const role of ROLES) {
      const sum = (role.isOrganizer ? 1 : 0) + (role.isResource ? 1 : 0)
      expect(sum, `${role.key} must be exactly one of isOrganizer/isResource`).toBe(1)
    }
  })

  it('no role has both isOrganizer and isResource', () => {
    for (const role of ROLES) {
      expect(
        role.isOrganizer && role.isResource,
        `${role.key} must not be hybrid`,
      ).toBe(false)
    }
  })

  it('total role count is 7', () => {
    expect(ROLES).toHaveLength(7)
  })
})

describe('Specific role assignments', () => {
  it('Venue is resource, not organizer', () => {
    const r = ROLE_BY_KEY['venue']
    expect(r.isOrganizer).toBe(false)
    expect(r.isResource).toBe(true)
  })

  it('DiveCenter, Agent are organizers', () => {
    const organizerKeys: RoleKey[] = ['dive-center', 'agent']
    for (const key of organizerKeys) {
      const r = ROLE_BY_KEY[key]
      expect(r.isOrganizer, `${key} should be organizer`).toBe(true)
      expect(r.isResource, `${key} should not be resource`).toBe(false)
    }
  })

  it('Instructor, Boat, Equipment, Venue, Compressor are all resources', () => {
    const resourceKeys: RoleKey[] = [
      'instructor',
      'boat',
      'equipment',
      'venue',
      'compressor',
    ]
    for (const key of resourceKeys) {
      const r = ROLE_BY_KEY[key]
      expect(r.isOrganizer, `${key} should not be organizer`).toBe(false)
      expect(r.isResource, `${key} should be resource`).toBe(true)
    }
  })
})

describe('Derived lists', () => {
  it('ORGANIZER_ROLES has exactly 2 members', () => {
    expect(ORGANIZER_ROLES).toHaveLength(2)
    const keys = ORGANIZER_ROLES.map((r) => r.key).sort()
    expect(keys).toEqual(['agent', 'dive-center'].sort())
  })

  it('RESOURCE_ROLES has exactly 5 members', () => {
    expect(RESOURCE_ROLES).toHaveLength(5)
    const keys = RESOURCE_ROLES.map((r) => r.key).sort()
    expect(keys).toEqual(
      ['boat', 'compressor', 'equipment', 'instructor', 'venue'].sort(),
    )
  })
})

describe('Display grouping', () => {
  it('DISPLAY_OPERATOR_ROLES has 2 members (all organizers)', () => {
    expect(DISPLAY_OPERATOR_ROLES).toHaveLength(2)
    const keys = DISPLAY_OPERATOR_ROLES.map((r) => r.key).sort()
    expect(keys).toEqual(['agent', 'dive-center'])
  })

  it('DISPLAY_RESOURCE_ROLES has 5 members', () => {
    expect(DISPLAY_RESOURCE_ROLES).toHaveLength(5)
    const keys = DISPLAY_RESOURCE_ROLES.map((r) => r.key).sort()
    expect(keys).toEqual(['boat', 'compressor', 'equipment', 'instructor', 'venue'])
  })

  it('every role: displayGroup matches isOrganizer flag', () => {
    for (const role of ROLES) {
      const expected = role.isOrganizer ? 'operator' : 'resource'
      expect(
        role.displayGroup,
        `${role.key} displayGroup should be "${expected}"`,
      ).toBe(expected)
    }
  })

  it('union of display groups covers all 7 roles with no gaps', () => {
    const displayKeys = new Set([
      ...DISPLAY_OPERATOR_ROLES.map((r) => r.key),
      ...DISPLAY_RESOURCE_ROLES.map((r) => r.key),
    ])
    expect(displayKeys.size).toBe(7)
    expect(displayKeys.size).toBe(ROLES.length)
    for (const role of ROLES) {
      expect(displayKeys.has(role.key), `${role.key} missing from display groups`).toBe(true)
    }
  })
})

describe('Lookup maps', () => {
  it('ROLE_BY_KEY has entry for every RoleKey', () => {
    const allKeys: RoleKey[] = ROLES.map((r) => r.key)
    for (const key of allKeys) {
      expect(ROLE_BY_KEY[key], `ROLE_BY_KEY missing ${key}`).not.toBeUndefined()
      expect(ROLE_BY_KEY[key].key).toBe(key)
    }
  })

  it('ROLE_BY_CLERK_ROLE has entry for every ClerkRole', () => {
    const allClerkRoles: ClerkRole[] = ROLES.map((r) => r.clerkRole)
    for (const cr of allClerkRoles) {
      expect(ROLE_BY_CLERK_ROLE[cr], `ROLE_BY_CLERK_ROLE missing ${cr}`).not.toBeUndefined()
      expect(ROLE_BY_CLERK_ROLE[cr].clerkRole).toBe(cr)
    }
  })
})

describe('Booking creation eligibility (isOrganizer gates QuickBookRail + createDraftShell)', () => {
  it('exactly these 2 roles can create bookings', () => {
    const keys = ORGANIZER_ROLES.map((r) => r.key).sort()
    expect(keys).toEqual(['agent', 'dive-center'])
  })

  it('exactly these 5 roles cannot create bookings', () => {
    const keys = RESOURCE_ROLES.map((r) => r.key).sort()
    expect(keys).toEqual(
      ['boat', 'compressor', 'equipment', 'instructor', 'venue'],
    )
  })
})
