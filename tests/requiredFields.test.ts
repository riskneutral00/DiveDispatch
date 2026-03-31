import { describe, it, expect } from 'vitest'
import {
  PROFILE_REQUIRED,
  SETTINGS_REQUIRED,
  ROLE_REQUIRED,
} from '../convex/lib/requiredFields'
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

describe('ROLE_REQUIRED', () => {
  it('defines required fields for DiveCenter', () => {
    const fields = ROLE_REQUIRED['DiveCenter']
    expect(fields).toBeDefined()
    expect(fields).toContain('name')
    expect(fields).toContain('placeName')
    expect(fields).toContain('country')
  })

  it('defines required fields for Instructor', () => {
    const fields = ROLE_REQUIRED['Instructor']
    expect(fields).toContain('credential')
    expect(fields).toContain('teachingLanguages')
  })

  it('DiveCenter requires customerLanguages', () => {
    expect(ROLE_REQUIRED['DiveCenter']).toContain('customerLanguages')
  })

  it('Boat requires fleet and diveSite', () => {
    const fields = ROLE_REQUIRED['Boat']
    expect(fields).toContain('fleet')
    expect(fields).toContain('diveSite')
  })

  it('Agent requires name, placeName, country, associations, customerLanguages', () => {
    const fields = ROLE_REQUIRED['Agent']
    expect(fields).toContain('name')
    expect(fields).toContain('associations')
    expect(fields).toContain('customerLanguages')
  })

  it('every role has name and placeName at minimum', () => {
    for (const [role, fields] of Object.entries(ROLE_REQUIRED)) {
      expect(fields).toContain('name')
      expect(fields).toContain('placeName')
    }
  })

  it('returns undefined for unknown role (no crash)', () => {
    expect(ROLE_REQUIRED['FakeRole']).toBeUndefined()
  })

  it('no role has duplicate required fields', () => {
    for (const [role, fields] of Object.entries(ROLE_REQUIRED)) {
      expect(new Set(fields).size, `${role} has duplicate fields`).toBe(fields.length)
    }
  })

  it('all field names are non-empty strings', () => {
    for (const [role, fields] of Object.entries(ROLE_REQUIRED)) {
      for (const field of fields) {
        expect(field.length, `${role} has empty field`).toBeGreaterThan(0)
      }
    }
  })

  it('Equipment, Pool, Compressor only require name and placeName', () => {
    expect(ROLE_REQUIRED.Equipment).toEqual(['name', 'placeName'])
    expect(ROLE_REQUIRED.Pool).toEqual(['name', 'placeName'])
    expect(ROLE_REQUIRED.Compressor).toEqual(['name', 'placeName'])
  })
})

// ── ROLE_REQUIRED ↔ ROLES alignment ───────────────────────────────────────────

describe('ROLE_REQUIRED ↔ ROLES alignment', () => {
  it('every ROLE_REQUIRED key is a valid ROLES clerkRole', () => {
    const clerkRoles = new Set<string>(ROLES.map((r) => r.clerkRole))
    for (const key of Object.keys(ROLE_REQUIRED)) {
      expect(clerkRoles.has(key), `ROLE_REQUIRED key "${key}" is not a valid clerkRole`).toBe(true)
    }
  })

  it('personnel roles (Instructor, DiveMaster) both have ROLE_REQUIRED entries', () => {
    expect(ROLE_REQUIRED.Instructor).toBeDefined()
    expect(ROLE_REQUIRED.DiveMaster).toBeDefined()
  })

  it('organizer roles (DiveCenter, Agent) both have ROLE_REQUIRED entries', () => {
    expect(ROLE_REQUIRED.DiveCenter).toBeDefined()
    expect(ROLE_REQUIRED.Agent).toBeDefined()
  })
})
