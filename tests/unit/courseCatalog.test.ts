import { describe, it, expect } from 'vitest'
import {
  COURSE_CATALOG,
  COURSE_CODES,
  COMBO_COURSES,
  getCourseByCode,
  getCoursesForAgency,
  courseLabel,
  COURSE_DISPLAY_LABELS,
} from '../../src/lib/constants/course-catalog'

describe('getCourseByCode', () => {
  it('returns PADI OW entry', () => {
    const ow = getCourseByCode('OW')
    expect(ow).toBeDefined()
    expect(ow!.code).toBe('OW')
    expect(ow!.requiresConfined).toBe(true)
  })

  it('returns undefined for invalid code', () => {
    expect(getCourseByCode('INVALID' as never)).toBeUndefined()
  })

  it('finds every COURSE_CODE in the catalog', () => {
    for (const code of COURSE_CODES) {
      expect(getCourseByCode(code)).toBeDefined()
    }
  })
})

describe('getCoursesForAgency', () => {
  it('returns only PADI courses for PADI', () => {
    const padi = getCoursesForAgency('PADI')
    expect(padi.length).toBeGreaterThan(0)
    expect(padi.every((c) => c.agency === 'PADI')).toBe(true)
  })

  it('returns only SSI courses for SSI', () => {
    const ssi = getCoursesForAgency('SSI')
    expect(ssi.length).toBeGreaterThan(0)
    expect(ssi.every((c) => c.agency === 'SSI')).toBe(true)
  })

  it('returns Universal courses', () => {
    const universal = getCoursesForAgency('Universal')
    expect(universal.length).toBeGreaterThan(0)
    expect(universal.every((c) => c.agency === 'Universal')).toBe(true)
  })
})

describe('courseLabel', () => {
  it('maps TRY_DIVE to "Try Dive"', () => {
    expect(courseLabel('TRY_DIVE')).toBe('Try Dive')
  })

  it('maps standard codes', () => {
    expect(courseLabel('OW')).toBe('OW')
    expect(courseLabel('AOW')).toBe('AOW')
    expect(courseLabel('DSD')).toBe('DSD')
    expect(courseLabel('RESCUE')).toBe('Rescue')
    expect(courseLabel('DM')).toBe('DM')
  })

  it('returns input for unknown code', () => {
    expect(courseLabel('UNKNOWN_THING')).toBe('UNKNOWN_THING')
  })

  it('has a label for every COURSE_CODE', () => {
    for (const code of COURSE_CODES) {
      expect(COURSE_DISPLAY_LABELS[code]).toBeTruthy()
    }
  })
})

describe('COURSE_CATALOG invariants', () => {
  it('every entry has positive minDays', () => {
    for (const entry of COURSE_CATALOG) {
      expect(entry.minDays).toBeGreaterThan(0)
    }
  })

  it('every entry has positive maxDiversPerInstructor', () => {
    for (const entry of COURSE_CATALOG) {
      expect(entry.maxDiversPerInstructor).toBeGreaterThan(0)
    }
  })

  it('prerequisites reference valid course codes', () => {
    const validCodes = new Set(COURSE_CODES)
    for (const entry of COURSE_CATALOG) {
      for (const prereq of entry.prerequisites) {
        expect(validCodes.has(prereq)).toBe(true)
      }
    }
  })

  it('no circular prerequisites at depth 1', () => {
    for (const entry of COURSE_CATALOG) {
      for (const prereq of entry.prerequisites) {
        const prereqEntry = getCourseByCode(prereq)
        if (prereqEntry) {
          expect(prereqEntry.prerequisites).not.toContain(entry.code)
        }
      }
    }
  })
})

describe('COMBO_COURSES', () => {
  it('O+A contains OW and AOW in order', () => {
    expect(COMBO_COURSES['O+A'].codes).toEqual(['OW', 'AOW'])
  })

  it('O+A minDays is at least sum of component minDays minus 1 (shared day)', () => {
    const owDays = getCourseByCode('OW')!.minDays
    const aowDays = getCourseByCode('AOW')!.minDays
    expect(COMBO_COURSES['O+A'].minDays).toBeGreaterThanOrEqual(owDays + aowDays - 1)
  })
})
