import { describe, it, expect } from 'vitest'
import {
  COURSE_CATALOG,
  getCourseByCode,
  getCoursesForAgency,
  type CourseCatalogEntry,
} from '../../src/lib/constants/course-catalog'
import { COURSE_CODES } from '../../convex/shared/courseCodes'

// ── PADI ↔ SSI course parity ───────────────────────────────────────────────────

describe('PADI ↔ SSI course parity', () => {
  const padiCourses = getCoursesForAgency('PADI')
  const ssiCourses = getCoursesForAgency('SSI')
  const padiCodes = new Set(padiCourses.map((c) => c.code))
  const ssiCodes = new Set(ssiCourses.map((c) => c.code))

  it('PADI and SSI offer the same course codes', () => {
    expect([...padiCodes].sort()).toEqual([...ssiCodes].sort())
  })

  it('PADI and SSI agree on prerequisite chains', () => {
    for (const code of padiCodes) {
      const padi = padiCourses.find((c) => c.code === code)!
      const ssi = ssiCourses.find((c) => c.code === code)!
      expect(padi.prerequisites.sort(), `${code} prerequisites differ`).toEqual(
        ssi.prerequisites.sort(),
      )
    }
  })

  it('PADI and SSI agree on requiresConfined', () => {
    for (const code of padiCodes) {
      const padi = padiCourses.find((c) => c.code === code)!
      const ssi = ssiCourses.find((c) => c.code === code)!
      expect(
        padi.requiresConfined,
        `${code} requiresConfined differs`,
      ).toBe(ssi.requiresConfined)
    }
  })

  it('PADI and SSI agree on minDays', () => {
    for (const code of padiCodes) {
      const padi = padiCourses.find((c) => c.code === code)!
      const ssi = ssiCourses.find((c) => c.code === code)!
      expect(padi.minDays, `${code} minDays differs`).toBe(ssi.minDays)
    }
  })

  it('PADI and SSI agree on repeatable flag', () => {
    for (const code of padiCodes) {
      const padi = padiCourses.find((c) => c.code === code)!
      const ssi = ssiCourses.find((c) => c.code === code)!
      expect(padi.repeatable, `${code} repeatable differs`).toBe(ssi.repeatable)
    }
  })
})

// ── Agency coverage ────────────────────────────────────────────────────────────

describe('course code coverage', () => {
  it('every COURSE_CODES entry appears in COURSE_CATALOG at least once', () => {
    for (const code of COURSE_CODES) {
      const entries = COURSE_CATALOG.filter((c) => c.code === code)
      expect(entries.length, `${code} not in COURSE_CATALOG`).toBeGreaterThan(0)
    }
  })

  it('Universal courses are agency-agnostic (no PADI/SSI duplicate)', () => {
    const universal = getCoursesForAgency('Universal')
    const padiCodes = new Set(getCoursesForAgency('PADI').map((c) => c.code))
    const ssiCodes = new Set(getCoursesForAgency('SSI').map((c) => c.code))
    for (const course of universal) {
      expect(padiCodes.has(course.code), `Universal ${course.code} also in PADI`).toBe(false)
      expect(ssiCodes.has(course.code), `Universal ${course.code} also in SSI`).toBe(false)
    }
  })

  it('COURSE_CATALOG covers exactly COURSE_CODES (no orphaned entries)', () => {
    const catalogCodes = new Set(COURSE_CATALOG.map((c) => c.code))
    const validCodes = new Set<string>(COURSE_CODES)
    for (const code of catalogCodes) {
      expect(validCodes.has(code), `Catalog code "${code}" not in COURSE_CODES`).toBe(true)
    }
  })
})

// ── DSD and intro course invariants ────────────────────────────────────────────

describe('DSD / intro course invariants', () => {
  it('DSD has no prerequisites (entry-level)', () => {
    const dsd = getCourseByCode('DSD')!
    expect(dsd.prerequisites).toEqual([])
  })

  it('DSD does not require confined water (dive-site or boat only)', () => {
    const dsd = getCourseByCode('DSD')!
    expect(dsd.requiresConfined).toBe(false)
  })

  it('TRY_DIVE has no prerequisites', () => {
    const tryDive = getCourseByCode('TRY_DIVE')!
    expect(tryDive.prerequisites).toEqual([])
  })

  it('TRY_DIVE does not require confined water', () => {
    const tryDive = getCourseByCode('TRY_DIVE')!
    expect(tryDive.requiresConfined).toBe(false)
  })

  it('OW has no prerequisites', () => {
    const ow = getCourseByCode('OW')!
    expect(ow.prerequisites).toEqual([])
  })

  it('DSD and TRY_DIVE are repeatable', () => {
    expect(getCourseByCode('DSD')!.repeatable).toBe(true)
    expect(getCourseByCode('TRY_DIVE')!.repeatable).toBe(true)
  })

  it('OW is not repeatable', () => {
    expect(getCourseByCode('OW')!.repeatable).toBe(false)
  })
})

// ── Certification chain: OW → AOW → RESCUE → DM ───────────────────────────────

describe('certification chain', () => {
  it('AOW requires OW', () => {
    expect(getCourseByCode('AOW')!.prerequisites).toContain('OW')
  })

  it('RESCUE requires AOW', () => {
    expect(getCourseByCode('RESCUE')!.prerequisites).toContain('AOW')
  })

  it('DM requires RESCUE', () => {
    expect(getCourseByCode('DM')!.prerequisites).toContain('RESCUE')
  })

  it('FD requires OW (certified divers only)', () => {
    expect(getCourseByCode('FD')!.prerequisites).toContain('OW')
  })

  it('REFRESH requires OW', () => {
    expect(getCourseByCode('REFRESH')!.prerequisites).toContain('OW')
  })

  it('SPECIALTY requires OW', () => {
    expect(getCourseByCode('SPECIALTY')!.prerequisites).toContain('OW')
  })
})

// ── maxDiversPerInstructor constraints ──────────────────────────────────────────

describe('maxDiversPerInstructor constraints', () => {
  it('DM is 1:1 (all agencies)', () => {
    const dmEntries = COURSE_CATALOG.filter((c) => c.code === 'DM')
    for (const entry of dmEntries) {
      expect(entry.maxDiversPerInstructor, `${entry.agency} DM`).toBe(1)
    }
  })

  it('REFRESH is max 2 divers per instructor', () => {
    const refresh = getCourseByCode('REFRESH')!
    expect(refresh.maxDiversPerInstructor).toBe(2)
  })

  it('DSD is max 4 per instructor (all agencies)', () => {
    const dsdEntries = COURSE_CATALOG.filter((c) => c.code === 'DSD')
    for (const entry of dsdEntries) {
      expect(entry.maxDiversPerInstructor, `${entry.agency} DSD`).toBe(4)
    }
  })

  it('SSI OW allows more divers than PADI OW', () => {
    const padiOW = getCoursesForAgency('PADI').find((c) => c.code === 'OW')!
    const ssiOW = getCoursesForAgency('SSI').find((c) => c.code === 'OW')!
    expect(ssiOW.maxDiversPerInstructor).toBeGreaterThan(padiOW.maxDiversPerInstructor)
  })

  it('no maxDiversPerInstructor exceeds 8', () => {
    for (const entry of COURSE_CATALOG) {
      expect(entry.maxDiversPerInstructor, `${entry.agency} ${entry.code}`).toBeLessThanOrEqual(8)
    }
  })
})

// ── Description and name sanity ────────────────────────────────────────────────

describe('catalog entry completeness', () => {
  it('every entry has a non-empty name', () => {
    for (const entry of COURSE_CATALOG) {
      expect(entry.name.length, `${entry.code} has empty name`).toBeGreaterThan(0)
    }
  })

  it('every entry has a non-empty description', () => {
    for (const entry of COURSE_CATALOG) {
      expect(entry.description.length, `${entry.code} has empty description`).toBeGreaterThan(0)
    }
  })

  it('PADI courses contain "PADI" in their name', () => {
    const padi = getCoursesForAgency('PADI')
    for (const entry of padi) {
      expect(entry.name, `${entry.code}`).toContain('PADI')
    }
  })

  it('SSI courses contain "SSI" in their name', () => {
    const ssi = getCoursesForAgency('SSI')
    for (const entry of ssi) {
      expect(entry.name, `${entry.code}`).toContain('SSI')
    }
  })
})
