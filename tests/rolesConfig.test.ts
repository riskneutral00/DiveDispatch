import { describe, it, expect } from 'vitest'
import { ROLES, ROLE_BY_CLERK_ROLE } from '../src/lib/constants/roles'
import type { ClerkRole, RoleKey } from '../src/lib/constants/roles'

describe('ROLES constant integrity', () => {
  it('has no duplicate clerkRole values', () => {
    const clerkRoles = ROLES.map((r) => r.clerkRole)
    expect(new Set(clerkRoles).size).toBe(clerkRoles.length)
  })

  it('has no duplicate keys', () => {
    const keys = ROLES.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every role has non-empty label and description', () => {
    for (const role of ROLES) {
      expect(role.label.length).toBeGreaterThan(0)
      expect(role.description.length).toBeGreaterThan(0)
    }
  })

  it('every role has a route starting with /', () => {
    for (const role of ROLES) {
      expect(role.route.startsWith('/')).toBe(true)
    }
  })

  it('every role has displayGroup of operator or resource', () => {
    for (const role of ROLES) {
      expect(['operator', 'resource']).toContain(role.displayGroup)
    }
  })

  it('organizer roles have isOrganizer true', () => {
    const organizers = ROLES.filter((r) => r.displayGroup === 'operator' && r.isOrganizer)
    expect(organizers.length).toBeGreaterThan(0)
  })

  it('has at least one resource role', () => {
    const resources = ROLES.filter((r) => r.isResource)
    expect(resources.length).toBeGreaterThan(0)
  })

  it('every role has roleClass of freelance or business', () => {
    for (const role of ROLES) {
      expect(['freelance', 'business']).toContain(role.roleClass)
    }
  })

  it('DiveCenter / Liveaboard / DiveResort / DiveHostel are business', () => {
    const businessKeys: ClerkRole[] = ['DiveCenter', 'Liveaboard', 'DiveResort', 'DiveHostel']
    for (const key of businessKeys) {
      expect(ROLE_BY_CLERK_ROLE[key].roleClass).toBe('business')
    }
  })

  it('Agent / DiveSite / Instructor / Boat / Equipment / Pool / Compressor are freelance', () => {
    const freelanceKeys: ClerkRole[] = [
      'Agent', 'DiveSite', 'Instructor', 'Boat', 'Equipment', 'Pool', 'Compressor',
    ]
    for (const key of freelanceKeys) {
      expect(ROLE_BY_CLERK_ROLE[key].roleClass).toBe('freelance')
    }
  })
})

describe('ROLE_BY_CLERK_ROLE', () => {
  it('has entries for every ROLES item', () => {
    for (const role of ROLES) {
      expect(ROLE_BY_CLERK_ROLE[role.clerkRole]).toBeDefined()
      expect(ROLE_BY_CLERK_ROLE[role.clerkRole].key).toBe(role.key)
    }
  })

  it('DiveCenter is an organizer', () => {
    expect(ROLE_BY_CLERK_ROLE['DiveCenter'].isOrganizer).toBe(true)
  })

  it('Instructor is a resource', () => {
    expect(ROLE_BY_CLERK_ROLE['Instructor'].isResource).toBe(true)
  })
})
