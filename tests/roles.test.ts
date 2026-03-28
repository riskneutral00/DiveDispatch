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

  it('matches ORGANIZER_ROLES length', () => {
    expect(ORGANIZER_ROLE_KEYS.size).toBe(ORGANIZER_ROLES.length)
  })

  it('does not include any resource-only roles', () => {
    for (const r of RESOURCE_ROLES) {
      expect(ORGANIZER_ROLE_KEYS.has(r.clerkRole)).toBe(false)
    }
  })

  it('is a proper Set (no duplicates possible)', () => {
    expect(ORGANIZER_ROLE_KEYS).toBeInstanceOf(Set)
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
