import { describe, it, expect } from 'vitest'
import {
  PROFILE_REQUIRED,
  SETTINGS_REQUIRED,
  ROLE_REQUIRED,
} from '../../convex/lib/requiredFields'
import { ROLES } from '../../src/lib/constants/roles'

// ── PROFILE_REQUIRED ───────────────────────────────────────────────────────────

describe('PROFILE_REQUIRED', () => {
  it('includes firstName and lastName', () => {
    expect(PROFILE_REQUIRED).toContain('firstName')
    expect(PROFILE_REQUIRED).toContain('lastName')
  })

  it('includes email and phone', () => {
    expect(PROFILE_REQUIRED).toContain('email')
    expect(PROFILE_REQUIRED).toContain('phone')
  })

  it('has no duplicates', () => {
    expect(new Set(PROFILE_REQUIRED).size).toBe(PROFILE_REQUIRED.length)
  })

  it('has exactly 4 fields', () => {
    expect(PROFILE_REQUIRED.length).toBe(4)
  })
})

// ── SETTINGS_REQUIRED ──────────────────────────────────────────────────────────

describe('SETTINGS_REQUIRED', () => {
  it('includes appLanguage', () => {
    expect(SETTINGS_REQUIRED).toContain('appLanguage')
  })

  it('has no duplicates', () => {
    expect(new Set(SETTINGS_REQUIRED).size).toBe(SETTINGS_REQUIRED.length)
  })
})

// ── ROLE_REQUIRED structural integrity ─────────────────────────────────────────

describe('ROLE_REQUIRED', () => {
  it('every role has at least name and placeName', () => {
    for (const [role, fields] of Object.entries(ROLE_REQUIRED)) {
      expect(fields, `${role} missing name`).toContain('name')
      expect(fields, `${role} missing placeName`).toContain('placeName')
    }
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

  it('Instructor and DiveMaster require credential and teachingLanguages', () => {
    expect(ROLE_REQUIRED.Instructor).toContain('credential')
    expect(ROLE_REQUIRED.Instructor).toContain('teachingLanguages')
    expect(ROLE_REQUIRED.DiveMaster).toContain('credential')
    expect(ROLE_REQUIRED.DiveMaster).toContain('teachingLanguages')
  })

  it('DiveCenter and Agent require associations', () => {
    expect(ROLE_REQUIRED.DiveCenter).toContain('associations')
    expect(ROLE_REQUIRED.Agent).toContain('associations')
  })

  it('DiveCenter requires customerLanguages', () => {
    expect(ROLE_REQUIRED.DiveCenter).toContain('customerLanguages')
  })

  it('Boat requires diveSite and fleet', () => {
    expect(ROLE_REQUIRED.Boat).toContain('diveSite')
    expect(ROLE_REQUIRED.Boat).toContain('fleet')
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
