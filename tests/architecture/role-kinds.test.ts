import { describe, it, expect } from 'vitest'
import {
  PERSON_ROLES,
  ENTITY_ROLES,
  ROLE_SPECS,
  isPersonRole,
  isEntityRole,
} from '../../convex/shared/roleKinds'
import { ROLE_TABLE_MAP } from '../../convex/lib/profileHelpers'

describe('roleKinds — PERSON vs ENTITY registry', () => {
  it('PERSON_ROLES and ENTITY_ROLES are disjoint', () => {
    const intersection = PERSON_ROLES.filter((r) =>
      (ENTITY_ROLES as readonly string[]).includes(r),
    )
    expect(intersection).toEqual([])
  })

  it('PERSON_ROLES ∪ ENTITY_ROLES exhausts ROLE_SPECS', () => {
    const union = new Set<string>([...PERSON_ROLES, ...ENTITY_ROLES])
    const specRoles = new Set<string>(Object.keys(ROLE_SPECS))
    expect(union).toEqual(specRoles)
  })

  it('every ROLE_SPECS entry declares table + kind', () => {
    for (const [role, spec] of Object.entries(ROLE_SPECS)) {
      expect(spec.table, `${role}.table`).toBeDefined()
      expect(['person', 'entity']).toContain(spec.kind)
    }
  })

  it('isPersonRole / isEntityRole match ROLE_SPECS.kind', () => {
    for (const [role, spec] of Object.entries(ROLE_SPECS)) {
      if (spec.kind === 'person') {
        expect(isPersonRole(role)).toBe(true)
        expect(isEntityRole(role)).toBe(false)
      } else {
        expect(isEntityRole(role)).toBe(true)
        expect(isPersonRole(role)).toBe(false)
      }
    }
  })

  it('ROLE_TABLE_MAP is re-derived from ROLE_SPECS (drift sentinel)', () => {
    for (const [role, spec] of Object.entries(ROLE_SPECS)) {
      expect(ROLE_TABLE_MAP[role]).toBe(spec.table)
    }
    expect(Object.keys(ROLE_TABLE_MAP).sort()).toEqual(Object.keys(ROLE_SPECS).sort())
  })
})
