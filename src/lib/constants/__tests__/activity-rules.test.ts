import { describe, it, expect } from 'vitest'
import {
  calcAgeAtDate,
  getMinAge,
  requiresCertification,
  isPassportExpiringSoon,
  ACTIVITY_MIN_AGE,
  CERT_REQUIRED_ACTIVITIES,
  NO_CERT_ACTIVITIES,
} from '../activity-rules'
import type { CourseCode } from '../../../../convex/shared/courseCodes'

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysFromNow(days: number, base: Date = new Date()): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function yearsFromNow(years: number, base: Date = new Date()): Date {
  const d = new Date(base)
  d.setFullYear(d.getFullYear() + years)
  return d
}

describe('calcAgeAtDate', () => {
  it('returns correct age when birthday has passed in the reference year', () => {
    const ref = new Date()
    const dob = new Date(ref)
    dob.setFullYear(dob.getFullYear() - 25)
    dob.setDate(dob.getDate() - 1)
    expect(calcAgeAtDate(fmt(dob), fmt(ref))).toBe(25)
  })

  it('returns correct age on the exact birthday', () => {
    const ref = new Date()
    const dob = new Date(ref)
    dob.setFullYear(dob.getFullYear() - 18)
    expect(calcAgeAtDate(fmt(dob), fmt(ref))).toBe(18)
  })

  it('returns age minus 1 when birthday has not yet passed in the reference year', () => {
    const ref = new Date()
    const dob = new Date(ref)
    dob.setFullYear(dob.getFullYear() - 18)
    dob.setDate(dob.getDate() + 1)
    expect(calcAgeAtDate(fmt(dob), fmt(ref))).toBe(17)
  })

  it('handles a 10-year-old at the DSD minimum age boundary', () => {
    const ref = new Date()
    const dob = new Date(ref)
    dob.setFullYear(dob.getFullYear() - 10)
    expect(calcAgeAtDate(fmt(dob), fmt(ref))).toBe(10)
  })

  it('handles a child born yesterday (age 0)', () => {
    const ref = new Date()
    const dob = daysFromNow(-1, ref)
    expect(calcAgeAtDate(fmt(dob), fmt(ref))).toBe(0)
  })

  it('handles same-day birth and reference (age 0)', () => {
    const ref = new Date()
    expect(calcAgeAtDate(fmt(ref), fmt(ref))).toBe(0)
  })

  it('uses the reference date, not today', () => {
    const today = new Date()
    const futureRef = yearsFromNow(1, today)
    const dob = new Date(today)
    dob.setFullYear(dob.getFullYear() - 17)
    expect(calcAgeAtDate(fmt(dob), fmt(futureRef))).toBe(18)
  })

  it('handles leap year birthday (Feb 29) checked on non-leap year', () => {
    let leapYear = new Date().getFullYear()
    while (leapYear % 4 !== 0 || (leapYear % 100 === 0 && leapYear % 400 !== 0)) {
      leapYear++
    }
    const dobStr = `${leapYear - 20}-02-29`
    const nonLeapYear = leapYear - 1
    const refStr = `${nonLeapYear}-03-01`
    const age = calcAgeAtDate(dobStr, refStr)
    expect(age).toBe(19)
  })
})

describe('getMinAge', () => {
  it('returns 0 for empty activity list', () => {
    expect(getMinAge([])).toBe(0)
  })

  it('returns correct minimum age for a single activity', () => {
    expect(getMinAge(['DSD'])).toBe(10)
    expect(getMinAge(['AOW'])).toBe(12)
    expect(getMinAge(['DM'])).toBe(18)
  })

  it('returns the most restrictive (highest) minimum across multiple activities', () => {
    expect(getMinAge(['DSD', 'AOW'])).toBe(12)
  })

  it('returns 18 when DM is included regardless of other activities', () => {
    expect(getMinAge(['DSD', 'OW', 'DM'])).toBe(18)
  })

  it('returns 10 for all beginner activities', () => {
    const beginnerCodes: CourseCode[] = ['DSD', 'TRY_DIVE', 'OW', 'FD', 'REFRESH']
    expect(getMinAge(beginnerCodes)).toBe(10)
  })

  it('every CourseCode has a defined minimum age', () => {
    for (const code of Object.keys(ACTIVITY_MIN_AGE) as CourseCode[]) {
      expect(ACTIVITY_MIN_AGE[code]).toBeGreaterThanOrEqual(10)
    }
  })
})

describe('requiresCertification', () => {
  it('returns false for empty list', () => {
    expect(requiresCertification([])).toBe(false)
  })

  it('returns false for all NO_CERT_ACTIVITIES', () => {
    expect(requiresCertification([...NO_CERT_ACTIVITIES])).toBe(false)
  })

  it('returns true when any CERT_REQUIRED_ACTIVITIES is present', () => {
    for (const code of CERT_REQUIRED_ACTIVITIES) {
      expect(requiresCertification([code])).toBe(true)
    }
  })

  it('returns true when cert-required activity is mixed with non-cert', () => {
    expect(requiresCertification(['DSD', 'AOW'])).toBe(true)
  })
})

describe('isPassportExpiringSoon', () => {
  it('returns false for empty date string', () => {
    expect(isPassportExpiringSoon('')).toBe(false)
  })

  it('returns true when passport is already expired', () => {
    const yesterday = fmt(daysFromNow(-1))
    const today = fmt(new Date())
    expect(isPassportExpiringSoon(yesterday, today)).toBe(true)
  })

  it('returns true when passport expires today', () => {
    const today = fmt(new Date())
    expect(isPassportExpiringSoon(today, today)).toBe(true)
  })

  it('returns true when passport expires in exactly 6 months', () => {
    const ref = new Date()
    const sixMonthsOut = new Date(ref)
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6)
    expect(isPassportExpiringSoon(fmt(sixMonthsOut), fmt(ref))).toBe(true)
  })

  it('returns true when passport expires in 3 months (within 6-month window)', () => {
    const ref = new Date()
    const threeMonthsOut = new Date(ref)
    threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3)
    expect(isPassportExpiringSoon(fmt(threeMonthsOut), fmt(ref))).toBe(true)
  })

  it('returns false when passport expires in 7 months (beyond 6-month window)', () => {
    const ref = new Date()
    const sevenMonthsOut = new Date(ref)
    sevenMonthsOut.setMonth(sevenMonthsOut.getMonth() + 7)
    expect(isPassportExpiringSoon(fmt(sevenMonthsOut), fmt(ref))).toBe(false)
  })

  it('returns false when passport expires in 2 years', () => {
    const ref = new Date()
    const twoYearsOut = yearsFromNow(2, ref)
    expect(isPassportExpiringSoon(fmt(twoYearsOut), fmt(ref))).toBe(false)
  })

  it('returns true when passport expires exactly 1 day before the 6-month mark', () => {
    const ref = new Date()
    const sixMonthsOut = new Date(ref)
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6)
    const oneDayBefore = new Date(sixMonthsOut)
    oneDayBefore.setDate(oneDayBefore.getDate() - 1)
    expect(isPassportExpiringSoon(fmt(oneDayBefore), fmt(ref))).toBe(true)
  })

  it('returns false when passport expires exactly 1 day after the 6-month mark', () => {
    const ref = new Date('2026-01-15T12:00:00Z')
    const sixMonthsOut = new Date(ref)
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6)
    const oneDayAfter = new Date(sixMonthsOut)
    oneDayAfter.setDate(oneDayAfter.getDate() + 1)
    expect(isPassportExpiringSoon(fmt(oneDayAfter), fmt(ref))).toBe(false)
  })

  it('defaults to today when no reference date provided', () => {
    const farFuture = fmt(yearsFromNow(5))
    expect(isPassportExpiringSoon(farFuture)).toBe(false)

    const pastDate = fmt(daysFromNow(-30))
    expect(isPassportExpiringSoon(pastDate)).toBe(true)
  })
})
