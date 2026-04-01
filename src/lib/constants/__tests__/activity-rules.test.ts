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

// ── Helpers ──────────────────────────────────────────────────────────

/** Formats a Date as YYYY-MM-DD string. */
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Returns a new Date offset by the given number of days from `base`. */
function daysFromNow(days: number, base: Date = new Date()): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

/** Returns a new Date offset by the given number of years from `base`. */
function yearsFromNow(years: number, base: Date = new Date()): Date {
  const d = new Date(base)
  d.setFullYear(d.getFullYear() + years)
  return d
}

/** Returns a YYYY-MM-DD string for a date that is `years` years before `ref`. */
function dobForAge(years: number, ref: Date = new Date()): string {
  const d = new Date(ref)
  d.setFullYear(d.getFullYear() - years)
  return fmt(d)
}

// ── calcAgeAtDate ────────────────────────────────────────────────────

describe('calcAgeAtDate', () => {
  it('returns correct age when birthday has passed in the reference year', () => {
    const ref = new Date()
    // Born exactly 25 years ago, 1 day in the past (birthday already passed)
    const dob = new Date(ref)
    dob.setFullYear(dob.getFullYear() - 25)
    dob.setDate(dob.getDate() - 1)
    expect(calcAgeAtDate(fmt(dob), fmt(ref))).toBe(25)
  })

  it('returns correct age on the exact birthday', () => {
    const ref = new Date()
    // Born exactly 18 years ago today
    const dob = new Date(ref)
    dob.setFullYear(dob.getFullYear() - 18)
    expect(calcAgeAtDate(fmt(dob), fmt(ref))).toBe(18)
  })

  it('returns age minus 1 when birthday has not yet passed in the reference year', () => {
    const ref = new Date()
    // Born 18 years ago but birthday is tomorrow
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
    // Future booking: reference date is 1 year from now
    const today = new Date()
    const futureRef = yearsFromNow(1, today)
    // Diver born 17 years ago — currently 17 but will be 18 at booking date
    const dob = new Date(today)
    dob.setFullYear(dob.getFullYear() - 17)
    expect(calcAgeAtDate(fmt(dob), fmt(futureRef))).toBe(18)
  })

  it('handles leap year birthday (Feb 29) checked on non-leap year', () => {
    // Find next leap year from now
    let leapYear = new Date().getFullYear()
    while (leapYear % 4 !== 0 || (leapYear % 100 === 0 && leapYear % 400 !== 0)) {
      leapYear++
    }
    const dobStr = `${leapYear - 20}-02-29`
    // Check on March 1 of a non-leap year (birthday hasn't "truly" passed)
    const nonLeapYear = leapYear - 1
    const refStr = `${nonLeapYear}-03-01`
    const age = calcAgeAtDate(dobStr, refStr)
    // On March 1, the person born Feb 29 should be considered to have had their birthday
    expect(age).toBe(19)
  })
})

// ── getMinAge ────────────────────────────────────────────────────────

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
    // DSD=10, AOW=12 → 12
    expect(getMinAge(['DSD', 'AOW'])).toBe(12)
  })

  it('returns 18 when DM is included regardless of other activities', () => {
    // DM=18 is the highest possible
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

// ── requiresCertification ────────────────────────────────────────────

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

// ── isPassportExpiringSoon ───────────────────────────────────────────

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
    // Fixed calendar anchor avoids `new Date()` / `setMonth` + timezone drift vs fmt(toISOString).
    const ref = new Date('2026-01-15T12:00:00Z')
    const sixMonthsOut = new Date(ref)
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6)
    const oneDayAfter = new Date(sixMonthsOut)
    oneDayAfter.setDate(oneDayAfter.getDate() + 1)
    expect(isPassportExpiringSoon(fmt(oneDayAfter), fmt(ref))).toBe(false)
  })

  it('defaults to today when no reference date provided', () => {
    // Passport expiring far in the future should always be false
    const farFuture = fmt(yearsFromNow(5))
    expect(isPassportExpiringSoon(farFuture)).toBe(false)

    // Passport already expired should always be true
    const pastDate = fmt(daysFromNow(-30))
    expect(isPassportExpiringSoon(pastDate)).toBe(true)
  })
})
