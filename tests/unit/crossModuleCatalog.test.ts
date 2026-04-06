import { describe, it, expect } from 'vitest'
import { COURSE_CATALOG, COURSE_DISPLAY_LABELS, COMBO_COURSES, type CourseCode } from '../../src/lib/constants/course-catalog'
import { COURSE_CODES } from '../../convex/shared/courseCodes'
import { AGENCIES, AGENCY_CODES, COURSE_DAY_RANGES, getMandatorySpecialties, getDefaultSpecialties } from '../../convex/shared/agencies'
import { AOW_SPECIALTY_VALUES, MANDATORY_AOW_SPECIALTIES } from '../../convex/shared/aowSelection'
import { INSTRUCTOR_REQUIRED_CODES, CONFINED_ACTIVITY_CODES } from '../../src/lib/constants/activity-rules'
import { CERT_REQUIRED_ACTIVITIES, NO_CERT_ACTIVITIES } from '../../src/lib/constants/activity-rules'
import { DIVE_AGENCIES, DIVE_AGENCIES_EXTENDED } from '../../src/lib/constants/agencies'
import { BOOKING_LINK_TTL_MS } from '../../convex/lib/timeConstants'
import { HOLD_TTL_MS } from '../../convex/lib/auth'

// ── Prerequisite integrity ──────────────────────────────────────────────────

describe('COURSE_CATALOG prerequisite integrity', () => {
  const validCodes = new Set<string>(COURSE_CODES)

  it('all prerequisites reference valid course codes', () => {
    for (const entry of COURSE_CATALOG) {
      for (const prereq of entry.prerequisites) {
        expect(validCodes.has(prereq), `${entry.code} prerequisite "${prereq}" is not a valid course code`).toBe(true)
      }
    }
  })

  it('no course is its own prerequisite', () => {
    for (const entry of COURSE_CATALOG) {
      expect(entry.prerequisites).not.toContain(entry.code)
    }
  })

  it('no circular prerequisite chains (depth-first check)', () => {
    const byCode = new Map(COURSE_CATALOG.map(e => [e.code, e]))
    function hasCycle(code: string, visited: Set<string>): boolean {
      if (visited.has(code)) return true
      visited.add(code)
      const entry = byCode.get(code as CourseCode)
      if (!entry) return false
      for (const prereq of entry.prerequisites) {
        if (hasCycle(prereq, new Set(visited))) return true
      }
      return false
    }
    for (const entry of COURSE_CATALOG) {
      expect(hasCycle(entry.code, new Set()), `${entry.code} has circular prerequisite chain`).toBe(false)
    }
  })
})

// ── Display labels completeness ─────────────────────────────────────────────

describe('COURSE_DISPLAY_LABELS completeness', () => {
  it('every COURSE_CODES entry has a display label', () => {
    for (const code of COURSE_CODES) {
      expect(COURSE_DISPLAY_LABELS).toHaveProperty(code)
    }
  })

  it('no display label keys outside COURSE_CODES', () => {
    for (const key of Object.keys(COURSE_DISPLAY_LABELS)) {
      expect(COURSE_CODES).toContain(key)
    }
  })
})

// ── Agency specialty alignment with AOW_SPECIALTIES ─────────────────────────

describe('agency specialty codes ↔ AOW_SPECIALTIES', () => {
  for (const [agencyCode, agency] of Object.entries(AGENCIES)) {
    describe(`${agencyCode}`, () => {
      it('adventure-dive specialties are valid AOW specialty values', () => {
        for (const spec of agency.specialties.filter(s => s.adventureDiveName !== null)) {
          expect(AOW_SPECIALTY_VALUES).toContain(spec.code)
        }
      })

      it('every specialty has code, label, and requiredForAOW', () => {
        for (const spec of agency.specialties) {
          expect(spec.code.length).toBeGreaterThan(0)
          expect(spec.label.length).toBeGreaterThan(0)
          expect(typeof spec.requiredForAOW).toBe('boolean')
        }
      })

      it('requiredForAOW specialties match the canonical MANDATORY_AOW_SPECIALTIES set', () => {
        const requiredInAgency = agency.specialties.filter(s => s.requiredForAOW).map(s => s.code)
        for (const code of requiredInAgency) {
          expect(MANDATORY_AOW_SPECIALTIES.has(code), `${agencyCode} marks "${code}" requiredForAOW but it is not in MANDATORY_AOW_SPECIALTIES`).toBe(true)
        }
      })

      it('getMandatorySpecialties returns a non-empty set', () => {
        const mandatory = getMandatorySpecialties(agencyCode)
        expect(mandatory.size).toBeGreaterThan(0)
      })

      it('getDefaultSpecialties returns mandatory codes in the list', () => {
        const defaults = getDefaultSpecialties(agencyCode)
        const mandatory = getMandatorySpecialties(agencyCode)
        for (const code of mandatory) {
          expect(defaults).toContain(code)
        }
      })
    })
  }

  it('getMandatorySpecialties returns empty for unknown agency', () => {
    expect(getMandatorySpecialties('FAKE_AGENCY').size).toBe(0)
  })
})

// ── DIVE_AGENCIES alignment ─────────────────────────────────────────────────

describe('DIVE_AGENCIES ↔ AGENCY_CODES', () => {
  it('AGENCY_CODES (catalog) are a subset of DIVE_AGENCIES', () => {
    for (const code of AGENCY_CODES) {
      expect(DIVE_AGENCIES).toContain(code)
    }
  })

  it('DIVE_AGENCIES_EXTENDED contains all DIVE_AGENCIES', () => {
    for (const agency of DIVE_AGENCIES) {
      expect(DIVE_AGENCIES_EXTENDED).toContain(agency)
    }
  })

  it('DIVE_AGENCIES_EXTENDED has more entries than DIVE_AGENCIES', () => {
    expect(DIVE_AGENCIES_EXTENDED.length).toBeGreaterThan(DIVE_AGENCIES.length)
  })
})

// ── Activity rule constants ↔ course catalog alignment ──────────────────────

describe('activity rules ↔ course catalog', () => {
  it('INSTRUCTOR_REQUIRED_CODES are all valid course codes', () => {
    for (const code of INSTRUCTOR_REQUIRED_CODES) {
      expect(COURSE_CODES).toContain(code)
    }
  })

  it('CONFINED_ACTIVITY_CODES are all valid course codes', () => {
    for (const code of CONFINED_ACTIVITY_CODES) {
      expect(COURSE_CODES).toContain(code)
    }
  })

  it('CERT_REQUIRED_ACTIVITIES are all valid course codes', () => {
    for (const code of CERT_REQUIRED_ACTIVITIES) {
      expect(COURSE_CODES).toContain(code)
    }
  })

  it('NO_CERT_ACTIVITIES are all valid course codes', () => {
    for (const code of NO_CERT_ACTIVITIES) {
      expect(COURSE_CODES).toContain(code)
    }
  })

  it('CERT_REQUIRED and NO_CERT do not overlap', () => {
    const certSet = new Set<string>(CERT_REQUIRED_ACTIVITIES)
    for (const code of NO_CERT_ACTIVITIES) {
      expect(certSet.has(code), `${code} is in both CERT_REQUIRED and NO_CERT`).toBe(false)
    }
  })

  it('CONFINED_ACTIVITY_CODES entries have requiresConfined=true in catalog', () => {
    for (const code of CONFINED_ACTIVITY_CODES) {
      const entry = COURSE_CATALOG.find(e => e.code === code)
      if (entry) {
        expect(entry.requiresConfined, `${code} is CONFINED but catalog says requiresConfined=${entry.requiresConfined}`).toBe(true)
      }
    }
  })
})

// ── COMBO_COURSES integrity ─────────────────────────────────────────────────

describe('COMBO_COURSES integrity', () => {
  it('O+A combo codes are valid course codes', () => {
    for (const code of COMBO_COURSES['O+A'].codes) {
      expect(COURSE_CODES).toContain(code)
    }
  })

  it('O+A minDays is less than sum of individual minDays (OW-4 doubles as AOW-1)', () => {
    let sumMinDays = 0
    for (const code of COMBO_COURSES['O+A'].codes) {
      const entry = COURSE_CATALOG.find(e => e.code === code)
      if (entry) sumMinDays += entry.minDays
    }
    expect(COMBO_COURSES['O+A'].minDays).toBeLessThan(sumMinDays)
  })

  it('O+A COURSE_DAY_RANGES min matches COMBO_COURSES minDays', () => {
    expect(COURSE_DAY_RANGES.combined.min).toBe(COMBO_COURSES['O+A'].minDays)
  })
})

// ── Time constant relationships ─────────────────────────────────────────────

describe('time constant relationships', () => {
  it('HOLD_TTL_MS < BOOKING_LINK_TTL_MS (hold expires before link)', () => {
    expect(HOLD_TTL_MS).toBeLessThan(BOOKING_LINK_TTL_MS)
  })

  it('HOLD_TTL_MS is exactly 12 hours', () => {
    expect(HOLD_TTL_MS).toBe(12 * 60 * 60 * 1000)
  })

  it('BOOKING_LINK_TTL_MS is exactly 30 days', () => {
    expect(BOOKING_LINK_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })
})
