import { describe, expect, it } from 'vitest'
import {
  ROLES,
  ORGANIZER_ROLES,
  ORGANIZER_ROLE_KEYS,
  DISPLAY_OPERATOR_ROLES,
  RESOURCE_ROLES,
} from '@/lib/constants/roles'

describe('ORGANIZER_ROLE_KEYS', () => {
  it('contains exactly the ClerkRole values where isOrganizer is true', () => {
    const expected = ROLES.filter((r) => r.isOrganizer).map((r) => r.clerkRole)
    expect([...ORGANIZER_ROLE_KEYS].sort()).toEqual(expected.sort())
  })

  it('does not include any resource-only roles', () => {
    for (const r of RESOURCE_ROLES) {
      expect(ORGANIZER_ROLE_KEYS.has(r.clerkRole)).toBe(false)
    }
  })

})

describe('isOrganizer / isResource mutual exclusivity', () => {
  it('every role has exactly one of isOrganizer or isResource set to true', () => {
    for (const role of ROLES) {
      expect(
        role.isOrganizer !== role.isResource,
        `${role.clerkRole} has isOrganizer=${role.isOrganizer} and isResource=${role.isResource} — must be mutually exclusive`,
      ).toBe(true)
    }
  })

  it('ORGANIZER_ROLES + RESOURCE_ROLES covers all ROLES', () => {
    const allFromGroups = new Set([
      ...ORGANIZER_ROLES.map((r) => r.clerkRole),
      ...RESOURCE_ROLES.map((r) => r.clerkRole),
    ])
    const allRoles = new Set(ROLES.map((r) => r.clerkRole))
    expect(allFromGroups).toEqual(allRoles)
  })

  it('ORGANIZER_ROLES and RESOURCE_ROLES have no overlap', () => {
    const orgSet = new Set(ORGANIZER_ROLES.map((r) => r.clerkRole))
    for (const r of RESOURCE_ROLES) {
      expect(orgSet.has(r.clerkRole)).toBe(false)
    }
  })
})

describe('DISPLAY_OPERATOR_ROLES', () => {
  it('contains exactly roles with displayGroup "operator"', () => {
    const expected = ROLES.filter((r) => r.displayGroup === 'operator')
    expect(DISPLAY_OPERATOR_ROLES).toEqual(expected)
  })

  it('includes DiveSite (displayGroup operator but isOrganizer false)', () => {
    const diveSite = DISPLAY_OPERATOR_ROLES.find((r) => r.clerkRole === 'DiveSite')
    expect(diveSite).toBeDefined()
    expect(diveSite!.isOrganizer).toBe(false)
  })
})
