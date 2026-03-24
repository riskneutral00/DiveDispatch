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

  it('total role count is 12', () => {
    expect(ROLES).toHaveLength(12)
  })
})

describe('Specific role assignments', () => {
  it('Liveaboard is organizer, not resource', () => {
    const r = ROLE_BY_KEY['liveaboard']
    expect(r.isOrganizer).toBe(true)
    expect(r.isResource).toBe(false)
  })

  it('DiveSite is resource, not organizer', () => {
    const r = ROLE_BY_KEY['dive-site']
    expect(r.isOrganizer).toBe(false)
    expect(r.isResource).toBe(true)
  })

  it('DiveCenter, Agent, DiveResort, DiveHostel are all organizers', () => {
    const organizerKeys: RoleKey[] = ['dive-center', 'agent', 'dive-resort', 'dive-hostel']
    for (const key of organizerKeys) {
      const r = ROLE_BY_KEY[key]
      expect(r.isOrganizer, `${key} should be organizer`).toBe(true)
      expect(r.isResource, `${key} should not be resource`).toBe(false)
    }
  })

  it('Instructor, DiveMaster, Boat, Equipment, Pool, Compressor are all resources', () => {
    const resourceKeys: RoleKey[] = [
      'instructor',
      'dive-master',
      'boat',
      'equipment',
      'pool',
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
  it('ORGANIZER_ROLES has exactly 5 members', () => {
    expect(ORGANIZER_ROLES).toHaveLength(5)
    const keys = ORGANIZER_ROLES.map((r) => r.key).sort()
    expect(keys).toEqual(
      ['agent', 'dive-center', 'dive-hostel', 'dive-resort', 'liveaboard'].sort(),
    )
  })

  it('RESOURCE_ROLES has exactly 7 members', () => {
    expect(RESOURCE_ROLES).toHaveLength(7)
    const keys = RESOURCE_ROLES.map((r) => r.key).sort()
    expect(keys).toEqual(
      ['boat', 'compressor', 'dive-master', 'dive-site', 'equipment', 'instructor', 'pool'].sort(),
    )
  })
})

describe('Display grouping', () => {
  it('DISPLAY_OPERATOR_ROLES has 6 members (5 organizers + DiveSite)', () => {
    expect(DISPLAY_OPERATOR_ROLES).toHaveLength(6)
    const keys = DISPLAY_OPERATOR_ROLES.map((r) => r.key)
    expect(keys).toContain('dive-site')
  })

  it('DISPLAY_RESOURCE_ROLES has 6 members (excludes DiveSite)', () => {
    expect(DISPLAY_RESOURCE_ROLES).toHaveLength(6)
    const keys = DISPLAY_RESOURCE_ROLES.map((r) => r.key)
    expect(keys).not.toContain('dive-site')
  })

  it('DiveSite has displayGroup "operator" (UI override)', () => {
    expect(ROLE_BY_KEY['dive-site'].displayGroup).toBe('operator')
  })

  it('every non-DiveSite role: displayGroup matches isOrganizer flag', () => {
    for (const role of ROLES) {
      if (role.key === 'dive-site') continue
      const expected = role.isOrganizer ? 'operator' : 'resource'
      expect(
        role.displayGroup,
        `${role.key} displayGroup should be "${expected}"`,
      ).toBe(expected)
    }
  })

  it('union of display groups covers all 12 roles with no gaps', () => {
    const displayKeys = new Set([
      ...DISPLAY_OPERATOR_ROLES.map((r) => r.key),
      ...DISPLAY_RESOURCE_ROLES.map((r) => r.key),
    ])
    expect(displayKeys.size).toBe(12)
    // Verify every ROLES entry is accounted for, with no extras
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
      expect(ROLE_BY_KEY[key], `ROLE_BY_KEY missing ${key}`).toBeDefined()
      expect(ROLE_BY_KEY[key].key).toBe(key)
    }
  })

  it('ROLE_BY_CLERK_ROLE has entry for every ClerkRole', () => {
    const allClerkRoles: ClerkRole[] = ROLES.map((r) => r.clerkRole)
    for (const cr of allClerkRoles) {
      expect(ROLE_BY_CLERK_ROLE[cr], `ROLE_BY_CLERK_ROLE missing ${cr}`).toBeDefined()
      expect(ROLE_BY_CLERK_ROLE[cr].clerkRole).toBe(cr)
    }
  })
})

describe('Booking creation eligibility (isOrganizer gates QuickBookRail + createDraftShell)', () => {
  it('exactly these 5 roles can create bookings', () => {
    const keys = ORGANIZER_ROLES.map((r) => r.key).sort()
    expect(keys).toEqual(
      ['agent', 'dive-center', 'dive-hostel', 'dive-resort', 'liveaboard'],
    )
  })

  it('exactly these 7 roles cannot create bookings', () => {
    const keys = RESOURCE_ROLES.map((r) => r.key).sort()
    expect(keys).toEqual(
      ['boat', 'compressor', 'dive-master', 'dive-site', 'equipment', 'instructor', 'pool'],
    )
  })
})
