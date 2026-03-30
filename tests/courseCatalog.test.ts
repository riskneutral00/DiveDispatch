import { describe, it, expect } from 'vitest'
import {
  getCourseByCode,
  getCoursesForAgency,
  courseLabel,
  COURSE_CATALOG,
  COMBO_COURSES,
} from '../src/lib/constants/course-catalog'

describe('getCourseByCode', () => {
  it('returns OW course entry', () => {
    const ow = getCourseByCode('OW')
    expect(ow).toBeDefined()
    expect(ow!.code).toBe('OW')
    expect(ow!.requiresConfined).toBe(true)
  })

  it('returns undefined for unknown code', () => {
    // @ts-expect-error testing invalid code
    expect(getCourseByCode('UNKNOWN')).toBeUndefined()
  })

  it('returns first match (PADI DSD over SSI DSD)', () => {
    const dsd = getCourseByCode('DSD')
    expect(dsd).toBeDefined()
    expect(dsd!.agency).toBe('PADI') // PADI comes first in the catalog
  })

  it('AOW has OW as prerequisite', () => {
    const aow = getCourseByCode('AOW')
    expect(aow!.prerequisites).toContain('OW')
  })

  it('DSD has no prerequisites', () => {
    const dsd = getCourseByCode('DSD')
    expect(dsd!.prerequisites).toEqual([])
  })
})

describe('getCoursesForAgency', () => {
  it('returns PADI courses', () => {
    const padi = getCoursesForAgency('PADI')
    expect(padi.length).toBeGreaterThan(0)
    expect(padi.every(c => c.agency === 'PADI')).toBe(true)
  })

  it('returns SSI courses', () => {
    const ssi = getCoursesForAgency('SSI')
    expect(ssi.length).toBeGreaterThan(0)
    expect(ssi.every(c => c.agency === 'SSI')).toBe(true)
  })

  it('returns Universal courses', () => {
    const uni = getCoursesForAgency('Universal')
    expect(uni.length).toBeGreaterThan(0)
    expect(uni.some(c => c.code === 'FD')).toBe(true)
  })
})

describe('courseLabel', () => {
  it('returns human-friendly label for known code', () => {
    expect(courseLabel('TRY_DIVE')).toBe('Try Dive')
    expect(courseLabel('OW')).toBe('OW')
    expect(courseLabel('RESCUE')).toBe('Rescue')
  })

  it('returns code itself for unknown code', () => {
    expect(courseLabel('UNKNOWN_CODE')).toBe('UNKNOWN_CODE')
  })
})

describe('COURSE_CATALOG', () => {
  it('contains entries for all course codes', () => {
    const codes = new Set(COURSE_CATALOG.map(c => c.code))
    expect(codes.has('DSD')).toBe(true)
    expect(codes.has('OW')).toBe(true)
    expect(codes.has('AOW')).toBe(true)
    expect(codes.has('FD')).toBe(true)
    expect(codes.has('REFRESH')).toBe(true)
  })

  it('all entries have positive minDays', () => {
    for (const entry of COURSE_CATALOG) {
      expect(entry.minDays).toBeGreaterThan(0)
    }
  })

  it('all entries have positive maxDiversPerInstructor', () => {
    for (const entry of COURSE_CATALOG) {
      expect(entry.maxDiversPerInstructor).toBeGreaterThan(0)
    }
  })
})

describe('COMBO_COURSES', () => {
  it('O+A combo has OW and AOW codes in order', () => {
    expect(COMBO_COURSES['O+A'].codes).toEqual(['OW', 'AOW'])
  })

  it('O+A combo has minDays of 4', () => {
    expect(COMBO_COURSES['O+A'].minDays).toBe(4)
  })
})
