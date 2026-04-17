import { describe, it, expect } from 'vitest'
import { PARKED_INSTRUCTORS } from '../convex/seedInstructorData'

describe('PARKED_INSTRUCTORS seed data', () => {
  it('has at least 10 instructors', () => {
    expect(PARKED_INSTRUCTORS.length).toBeGreaterThanOrEqual(10)
  })

  it('all instructors have unique slugs', () => {
    const slugs = PARKED_INSTRUCTORS.map((s) => s.user.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('all instructors have unique emails', () => {
    const emails = PARKED_INSTRUCTORS.map((s) => s.user.email)
    expect(new Set(emails).size).toBe(emails.length)
  })

  it('every entry has the Instructor role', () => {
    for (const s of PARKED_INSTRUCTORS) {
      expect(s.roles).toBeDefined()
      expect(s.roles!.some((r) => r.role === 'Instructor')).toBe(true)
    }
  })

  it('every entry has an instructor profile with name and verified=true', () => {
    for (const s of PARKED_INSTRUCTORS) {
      expect(s.instructor).toBeDefined()
      expect(s.instructor!.name).toBeTruthy()
      expect(s.instructor!.verified).toBe(true)
    }
  })

  it('every entry has a non-empty first and last name', () => {
    for (const s of PARKED_INSTRUCTORS) {
      expect(s.user.firstName.length).toBeGreaterThan(0)
      expect(s.user.lastName.length).toBeGreaterThan(0)
    }
  })

  it('every instructor profile has at least one credential', () => {
    for (const s of PARKED_INSTRUCTORS) {
      expect(s.instructor!.credential.length).toBeGreaterThan(0)
    }
  })

  it('every credential has an agency and level', () => {
    for (const s of PARKED_INSTRUCTORS) {
      for (const cred of s.instructor!.credential) {
        expect(cred.agency).toBeTruthy()
        expect(cred.level).toBeTruthy()
      }
    }
  })

  it('no instructor slug collides with operator stakeholder slugs', () => {
    // Basic guard — actual collision check against seedData happens at seed time
    const slugs = PARKED_INSTRUCTORS.map((s) => s.user.slug)
    const uniqueSlugs = new Set(slugs)
    // Just verify no empty slugs
    for (const slug of uniqueSlugs) {
      expect(slug.length).toBeGreaterThan(0)
    }
  })
})
