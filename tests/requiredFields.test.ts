import { describe, it, expect } from 'vitest'
import {
  PROFILE_REQUIRED,
  SETTINGS_REQUIRED,
} from '../convex/lib/requiredFields'
import { ROLE_SPECS } from '../convex/lib/completeness/roleSpecs'
import { ROLES } from '../src/lib/constants/roles'

describe('PROFILE_REQUIRED', () => {
  it('includes firstName, lastName, email, phone', () => {
    expect(PROFILE_REQUIRED).toContain('firstName')
    expect(PROFILE_REQUIRED).toContain('lastName')
    expect(PROFILE_REQUIRED).toContain('email')
    expect(PROFILE_REQUIRED).toContain('phone')
  })

  it('has no duplicates', () => {
    expect(new Set(PROFILE_REQUIRED).size).toBe(PROFILE_REQUIRED.length)
  })
})

describe('SETTINGS_REQUIRED', () => {
  it('includes appLanguage', () => {
    expect(SETTINGS_REQUIRED).toContain('appLanguage')
  })
})

describe('ROLE_SPECS ↔ ROLES alignment', () => {
  it('every ROLE_SPECS key is a valid ROLES clerkRole', () => {
    const clerkRoles = new Set<string>(ROLES.map((r) => r.clerkRole))
    for (const key of Object.keys(ROLE_SPECS)) {
      expect(clerkRoles.has(key), `ROLE_SPECS key "${key}" is not a valid clerkRole`).toBe(true)
    }
  })

  it('every ROLES clerkRole has a ROLE_SPECS entry with ≥1 evaluator', () => {
    for (const role of ROLES) {
      const evaluators = ROLE_SPECS[role.clerkRole]
      expect(evaluators, `ROLE_SPECS missing entry for "${role.clerkRole}"`).toBeDefined()
      expect(
        evaluators.length,
        `ROLE_SPECS["${role.clerkRole}"] has zero evaluators`,
      ).toBeGreaterThan(0)
    }
  })

  it('returns undefined for unknown role (no crash)', () => {
    expect(ROLE_SPECS['FakeRole']).toBeUndefined()
  })
})
