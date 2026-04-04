import { describe, it, expect } from 'vitest'
import { ROLES, ORGANIZER_ROLES, RESOURCE_ROLES, ROLE_BY_KEY, ROLE_BY_CLERK_ROLE, ORGANIZER_ROLE_KEYS, DISPLAY_OPERATOR_ROLES, DISPLAY_RESOURCE_ROLES } from '../../src/lib/constants/roles'
import { ORGANIZER_WIZARD_CONFIG, ORGANIZER_WIZARD_ROLES, getOrganizerRoleFlags } from '../../src/lib/constants/organizer-wizard-config'
import { RESOURCE_OWNER_TYPES } from '../../convex/shared/resourceOwnerTypes'
import { PROFILE_REGISTRY } from '../../src/lib/constants/profile-registry'
import { ROLE_PRECEDENCE } from '../../convex/lib/rolePrecedence'

// ── ROLES route uniqueness ──────────────────────────────────────────────────

describe('ROLES route uniqueness', () => {
  it('no duplicate routes', () => {
    const routes = ROLES.map((r) => r.route)
    expect(new Set(routes).size).toBe(routes.length)
  })

  it('no duplicate browseRoutes', () => {
    const browseRoutes = ROLES.map((r) => r.browseRoute)
    expect(new Set(browseRoutes).size).toBe(browseRoutes.length)
  })

  it('routes are kebab-case segments', () => {
    for (const role of ROLES) {
      expect(role.route).toMatch(/^\/[a-z-]+$/)
    }
  })

  it('browseRoutes start with /resources/ or /directory', () => {
    for (const role of ROLES) {
      expect(
        role.browseRoute.startsWith('/resources/') || role.browseRoute.startsWith('/directory'),
        `${role.clerkRole} browseRoute "${role.browseRoute}" has unexpected prefix`,
      ).toBe(true)
    }
  })
})

// ── ROLES tableName consistency ─────────────────────────────────────────────

describe('ROLES tableName consistency', () => {
  it('every role has a non-empty tableName', () => {
    for (const role of ROLES) {
      expect(role.tableName.length, `${role.clerkRole} has empty tableName`).toBeGreaterThan(0)
    }
  })

  it('every role has a non-empty pluralLabel', () => {
    for (const role of ROLES) {
      expect(role.pluralLabel.length, `${role.clerkRole} has empty pluralLabel`).toBeGreaterThan(0)
    }
  })

  it('Pool and DiveSite share venues tableName', () => {
    expect(ROLE_BY_CLERK_ROLE['Pool'].tableName).toBe('venues')
    expect(ROLE_BY_CLERK_ROLE['DiveSite'].tableName).toBe('venues')
  })

  it('no non-venue roles share a tableName with venues', () => {
    const venueRoles = ROLES.filter((r) => r.tableName === 'venues')
    const venueClerkRoles = new Set(venueRoles.map((r) => r.clerkRole))
    expect(venueClerkRoles.has('Pool')).toBe(true)
    expect(venueClerkRoles.has('DiveSite')).toBe(true)
    expect(venueClerkRoles.size).toBe(2)
  })
})

// ── ROLES ↔ ORGANIZER_WIZARD_CONFIG alignment ──────────────────────────────

describe('ROLES ↔ ORGANIZER_WIZARD_CONFIG', () => {
  it('every ORGANIZER_WIZARD_CONFIG key is a valid clerkRole', () => {
    const clerkRoles = new Set<string>(ROLES.map((r) => r.clerkRole))
    for (const key of Object.keys(ORGANIZER_WIZARD_CONFIG)) {
      expect(clerkRoles.has(key), `ORGANIZER_WIZARD_CONFIG key "${key}" is not a valid clerkRole`).toBe(true)
    }
  })

  it('every organizer role with isOrganizer=true has a wizard config', () => {
    for (const role of ORGANIZER_ROLES) {
      expect(
        ORGANIZER_WIZARD_CONFIG[role.clerkRole],
        `Organizer role ${role.clerkRole} missing from ORGANIZER_WIZARD_CONFIG`,
      ).toBeDefined()
    }
  })

  it('ORGANIZER_WIZARD_ROLES matches ORGANIZER_WIZARD_CONFIG keys', () => {
    const configKeys = Object.keys(ORGANIZER_WIZARD_CONFIG).sort()
    const wizardRoles = [...ORGANIZER_WIZARD_ROLES].sort()
    expect(wizardRoles).toEqual(configKeys)
  })

  it('getOrganizerRoleFlags returns valid flags for every ROLES clerkRole', () => {
    for (const role of ROLES) {
      const flags = getOrganizerRoleFlags(role.clerkRole)
      expect(flags.displayLabel.length).toBeGreaterThan(0)
      expect(['single', 'multi']).toContain(flags.locationModel)
      expect(typeof flags.supportsCoursePreferences).toBe('boolean')
    }
  })
})

// ── ROLES ↔ RESOURCE_OWNER_TYPES reverse alignment ─────────────────────────

describe('RESOURCE_OWNER_TYPES ↔ ROLES', () => {
  it('every RESOURCE_OWNER_TYPES entry maps to a valid clerkRole in ROLES', () => {
    const clerkRoles = new Set(ROLES.map((r) => r.clerkRole))
    for (const type of RESOURCE_OWNER_TYPES) {
      expect(clerkRoles.has(type), `RESOURCE_OWNER_TYPES entry "${type}" not found in ROLES`).toBe(true)
    }
  })

  it('every RESOURCE_OWNER_TYPES entry maps to a role with isResource=true OR is an organizer that owns inventory (Liveaboard)', () => {
    for (const type of RESOURCE_OWNER_TYPES) {
      const role = ROLE_BY_CLERK_ROLE[type as keyof typeof ROLE_BY_CLERK_ROLE]
      const isResourceOwner = role?.isResource || role?.isOrganizer
      expect(isResourceOwner, `${type} should be a resource or organizer`).toBe(true)
    }
  })

  it('DiveMaster is NOT in RESOURCE_OWNER_TYPES (mapped via Instructor)', () => {
    expect(RESOURCE_OWNER_TYPES).not.toContain('DiveMaster')
  })
})

// ── ROLES display group partitioning ────────────────────────────────────────

describe('ROLES display group partitioning', () => {
  it('DISPLAY_OPERATOR_ROLES + DISPLAY_RESOURCE_ROLES covers all ROLES', () => {
    const combined = new Set([
      ...DISPLAY_OPERATOR_ROLES.map((r) => r.clerkRole),
      ...DISPLAY_RESOURCE_ROLES.map((r) => r.clerkRole),
    ])
    expect(combined.size).toBe(ROLES.length)
  })

  it('DISPLAY_OPERATOR_ROLES and DISPLAY_RESOURCE_ROLES do not overlap', () => {
    const operatorKeys = new Set(DISPLAY_OPERATOR_ROLES.map((r) => r.clerkRole))
    for (const role of DISPLAY_RESOURCE_ROLES) {
      expect(operatorKeys.has(role.clerkRole), `${role.clerkRole} is in both display groups`).toBe(false)
    }
  })

  it('DiveSite is in DISPLAY_OPERATOR_ROLES despite being isResource', () => {
    const diveSite = ROLE_BY_CLERK_ROLE['DiveSite']
    expect(diveSite.isResource).toBe(true)
    expect(diveSite.isOrganizer).toBe(false)
    expect(diveSite.displayGroup).toBe('operator')
    expect(DISPLAY_OPERATOR_ROLES).toContain(diveSite)
  })
})

// ── ROLES ↔ ROLE_PRECEDENCE completeness ────────────────────────────────────

describe('ROLE_PRECEDENCE completeness', () => {
  it('precedence values are unique integers', () => {
    const values = Object.values(ROLE_PRECEDENCE)
    expect(new Set(values).size).toBe(values.length)
    for (const v of values) {
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('organizer roles have lower precedence numbers (higher priority) than resource roles', () => {
    const orgPrecs = ORGANIZER_ROLES.map((r) => ROLE_PRECEDENCE[r.clerkRole as keyof typeof ROLE_PRECEDENCE])
    const resPrecs = RESOURCE_ROLES.map((r) => ROLE_PRECEDENCE[r.clerkRole as keyof typeof ROLE_PRECEDENCE])
    const maxOrg = Math.max(...orgPrecs)
    const minRes = Math.min(...resPrecs)
    expect(maxOrg).toBeLessThan(minRes)
  })
})

// ── ORGANIZER_ROLE_KEYS derived set ─────────────────────────────────────────

describe('ORGANIZER_ROLE_KEYS derived set', () => {
  it('matches ORGANIZER_ROLES clerkRole set', () => {
    const fromRoles = new Set(ORGANIZER_ROLES.map((r) => r.clerkRole))
    expect(ORGANIZER_ROLE_KEYS).toEqual(fromRoles)
  })

  it('does not contain any resource-only roles', () => {
    for (const role of RESOURCE_ROLES) {
      expect(ORGANIZER_ROLE_KEYS.has(role.clerkRole)).toBe(false)
    }
  })
})

// ── PROFILE_REGISTRY ↔ ROLES reverse coverage ──────────────────────────────

describe('PROFILE_REGISTRY ↔ ROLES reverse coverage', () => {
  it('every ROLES key has a PROFILE_REGISTRY entry (derived from profileTabs)', () => {
    for (const role of ROLES) {
      expect(
        PROFILE_REGISTRY[role.key],
        `${role.key} (${role.clerkRole}) missing from PROFILE_REGISTRY`,
      ).toBeDefined()
    }
  })
})

// ── profileTabs on RoleConfig ───────────────────────────────────────────────

describe('RoleConfig.profileTabs', () => {
  it('every role has a non-empty profileTabs array', () => {
    for (const role of ROLES) {
      expect(role.profileTabs.length, `${role.key} has empty profileTabs`).toBeGreaterThan(0)
    }
  })

  it('profileTabs match derived PROFILE_REGISTRY tabs', () => {
    for (const role of ROLES) {
      expect(role.profileTabs).toEqual(PROFILE_REGISTRY[role.key].tabs)
    }
  })

  it('every role has booking as last tab', () => {
    for (const role of ROLES) {
      const lastTab = role.profileTabs[role.profileTabs.length - 1]
      expect(lastTab.id, `${role.key} last tab is "${lastTab.id}" not "booking"`).toBe('booking')
    }
  })
})
