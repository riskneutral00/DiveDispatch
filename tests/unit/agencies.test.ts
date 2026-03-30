import { describe, it, expect } from 'vitest'
import {
  AGENCIES,
  AGENCY_CODES,
  COURSE_DAY_RANGES,
  getMandatorySpecialties,
  getDefaultSpecialties,
} from '../../convex/shared/agencies'

describe('AGENCIES data integrity', () => {
  it('has PADI and SSI entries', () => {
    expect(AGENCY_CODES).toContain('PADI')
    expect(AGENCY_CODES).toContain('SSI')
  })

  it('each agency has required fields', () => {
    for (const [code, agency] of Object.entries(AGENCIES)) {
      expect(agency.code).toBe(code)
      expect(agency.name).toBeTruthy()
      expect(agency.memberIdLabel).toBeTruthy()
      expect(agency.courses.length).toBeGreaterThan(0)
      expect(agency.specialties.length).toBeGreaterThan(0)
      expect(agency.specialtyCount).toBeGreaterThan(0)
    }
  })

  it('COURSE_DAY_RANGES has valid min <= max', () => {
    for (const [, range] of Object.entries(COURSE_DAY_RANGES)) {
      expect(range.min).toBeLessThanOrEqual(range.max)
      expect(range.min).toBeGreaterThan(0)
    }
  })
})

describe('getMandatorySpecialties', () => {
  it('returns Navigation and Deep for PADI', () => {
    const mandatory = getMandatorySpecialties('PADI')
    expect(mandatory.has('Navigation')).toBe(true)
    expect(mandatory.has('Deep')).toBe(true)
    expect(mandatory.size).toBe(2)
  })

  it('returns Navigation and Deep for SSI', () => {
    const mandatory = getMandatorySpecialties('SSI')
    expect(mandatory.has('Navigation')).toBe(true)
    expect(mandatory.has('Deep')).toBe(true)
  })

  it('returns empty set for unknown agency', () => {
    expect(getMandatorySpecialties('UNKNOWN').size).toBe(0)
  })
})

describe('getDefaultSpecialties', () => {
  it('returns mandatory specialties as default for PADI', () => {
    const defaults = getDefaultSpecialties('PADI')
    expect(defaults).toContain('Navigation')
    expect(defaults).toContain('Deep')
  })

  it('returns empty array for unknown agency', () => {
    expect(getDefaultSpecialties('UNKNOWN')).toEqual([])
  })
})
