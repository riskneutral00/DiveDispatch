import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  requiresCertification,
  getMinAge,
  calcAgeAtDate,
  isPassportExpiringSoon,
  CERT_REQUIRED_ACTIVITIES,
  NO_CERT_ACTIVITIES,
  ACTIVITY_MIN_AGE,
} from '../src/lib/constants/activity-rules'
import type { CourseCode } from '../src/lib/constants/course-catalog'

describe('requiresCertification', () => {
  it('returns true for AOW (cert required)', () => {
    expect(requiresCertification(['AOW'])).toBe(true)
  })

  it('returns true when any activity requires cert', () => {
    expect(requiresCertification(['OW', 'AOW'])).toBe(true)
  })

  it('returns false for OW (no cert required)', () => {
    expect(requiresCertification(['OW'])).toBe(false)
  })

  it('returns false for DSD (no cert required)', () => {
    expect(requiresCertification(['DSD'])).toBe(false)
  })

  it('returns false for empty list', () => {
    expect(requiresCertification([])).toBe(false)
  })

  it('returns true for every CERT_REQUIRED activity individually', () => {
    for (const activity of CERT_REQUIRED_ACTIVITIES) {
      expect(requiresCertification([activity])).toBe(true)
    }
  })

  it('returns false for every NO_CERT activity individually', () => {
    for (const activity of NO_CERT_ACTIVITIES) {
      expect(requiresCertification([activity])).toBe(false)
    }
  })
})

describe('getMinAge', () => {
  it('returns 0 for empty list', () => {
    expect(getMinAge([])).toBe(0)
  })

  it('returns 10 for DSD', () => {
    expect(getMinAge(['DSD'])).toBe(10)
  })

  it('returns 18 for DM', () => {
    expect(getMinAge(['DM'])).toBe(18)
  })

  it('returns highest minimum when multiple activities', () => {
    expect(getMinAge(['DSD', 'AOW', 'DM'])).toBe(18)
  })

  it('returns 12 for AOW', () => {
    expect(getMinAge(['AOW'])).toBe(12)
  })

  it('returns 10 for OW + FD (both 10)', () => {
    expect(getMinAge(['OW', 'FD'])).toBe(10)
  })
})

describe('calcAgeAtDate', () => {
  it('calculates exact age when birthday has passed', () => {
    expect(calcAgeAtDate('2000-01-15', '2026-03-28')).toBe(26)
  })

  it('calculates age when birthday has not yet occurred this year', () => {
    expect(calcAgeAtDate('2000-06-15', '2026-03-28')).toBe(25)
  })

  it('calculates age on exact birthday', () => {
    expect(calcAgeAtDate('2000-03-28', '2026-03-28')).toBe(26)
  })

  it('calculates age day before birthday', () => {
    expect(calcAgeAtDate('2000-03-29', '2026-03-28')).toBe(25)
  })

  it('calculates age day after birthday', () => {
    expect(calcAgeAtDate('2000-03-27', '2026-03-28')).toBe(26)
  })

  it('handles leap year birthday (Feb 29)', () => {
    // Person born on Feb 29, checked on Mar 1 in a non-leap year
    expect(calcAgeAtDate('2000-02-29', '2026-03-01')).toBe(26)
  })

  it('returns 0 for same date', () => {
    expect(calcAgeAtDate('2026-03-28', '2026-03-28')).toBe(0)
  })
})

describe('isPassportExpiringSoon', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false for empty string', () => {
    expect(isPassportExpiringSoon('')).toBe(false)
  })

  it('returns true when passport expires within 6 months', () => {
    expect(isPassportExpiringSoon('2026-06-01', '2026-03-28')).toBe(true)
  })

  it('returns false when passport expires after 6 months', () => {
    expect(isPassportExpiringSoon('2027-03-28', '2026-03-28')).toBe(false)
  })

  it('returns true when passport expires exactly at 6-month boundary', () => {
    // Sept 28 is exactly 6 months from March 28
    expect(isPassportExpiringSoon('2026-09-28', '2026-03-28')).toBe(true)
  })

  it('returns true when passport is already expired', () => {
    expect(isPassportExpiringSoon('2025-01-01', '2026-03-28')).toBe(true)
  })

  it('returns false when passport expires well into the future', () => {
    expect(isPassportExpiringSoon('2030-01-01', '2026-03-28')).toBe(false)
  })
})

describe('constants integrity', () => {
  it('ACTIVITY_MIN_AGE has entries for all course codes', () => {
    const allCodes = [...CERT_REQUIRED_ACTIVITIES, ...NO_CERT_ACTIVITIES]
    for (const code of allCodes) {
      expect(ACTIVITY_MIN_AGE[code]).toBeGreaterThanOrEqual(0)
    }
  })

  it('CERT_REQUIRED and NO_CERT lists do not overlap', () => {
    const certSet = new Set<string>(CERT_REQUIRED_ACTIVITIES)
    for (const code of NO_CERT_ACTIVITIES) {
      expect(certSet.has(code)).toBe(false)
    }
  })
})
