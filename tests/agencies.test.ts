import { describe, it, expect } from 'vitest'
import {
  getMandatorySpecialties,
  getDefaultSpecialties,
  AGENCIES,
  COURSE_DAY_RANGES,
} from '../convex/shared/agencies'

describe('getMandatorySpecialties', () => {
  it('returns Navigation and Deep for PADI', () => {
    const mandatory = getMandatorySpecialties('PADI')
    expect(mandatory).toEqual(new Set(['Navigation', 'Deep']))
  })

  it('returns Navigation and Deep for SSI', () => {
    const mandatory = getMandatorySpecialties('SSI')
    expect(mandatory).toEqual(new Set(['Navigation', 'Deep']))
  })

  it('returns empty set for unknown agency', () => {
    const mandatory = getMandatorySpecialties('UNKNOWN_AGENCY')
    expect(mandatory.size).toBe(0)
  })
})

describe('getDefaultSpecialties', () => {
  it('returns mandatory specialties as default selections for PADI', () => {
    const defaults = getDefaultSpecialties('PADI')
    expect(defaults).toContain('Navigation')
    expect(defaults).toContain('Deep')
    expect(defaults.length).toBe(2)
  })

  it('returns empty array for unknown agency', () => {
    expect(getDefaultSpecialties('FAKE')).toEqual([])
  })
})

describe('AGENCIES constants', () => {
  it('defines PADI and SSI', () => {
    expect(Object.keys(AGENCIES)).toContain('PADI')
    expect(Object.keys(AGENCIES)).toContain('SSI')
  })

  it('PADI has the expected specialtyCount', () => {
    expect(AGENCIES.PADI.specialtyCount).toBe(5)
  })

  it('SSI has the expected specialtyCount', () => {
    expect(AGENCIES.SSI.specialtyCount).toBe(5)
  })

  it('every agency has a non-empty memberIdLabel', () => {
    for (const agency of Object.values(AGENCIES)) {
      expect(agency.memberIdLabel.length).toBeGreaterThan(0)
    }
  })
})

describe('COURSE_DAY_RANGES', () => {
  it('OW range is 2-4 days', () => {
    expect(COURSE_DAY_RANGES.OW).toEqual({ min: 2, max: 4 })
  })

  it('AOW range is 2-4 days', () => {
    expect(COURSE_DAY_RANGES.AOW).toEqual({ min: 2, max: 4 })
  })

  it('combined range is 4-6 days', () => {
    expect(COURSE_DAY_RANGES.combined).toEqual({ min: 4, max: 6 })
  })
})
