import { describe, it, expect } from 'vitest'
import {
  PROFILE_REQUIRED,
  SETTINGS_REQUIRED,
  ROLE_REQUIRED,
} from '../convex/lib/requiredFields'

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

  it('Agent requires name, placeName, country, associations', () => {
    const fields = ROLE_REQUIRED['Agent']
    expect(fields).toContain('name')
    expect(fields).toContain('associations')
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
})
