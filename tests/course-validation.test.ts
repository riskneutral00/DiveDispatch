import { describe, it, expect } from 'vitest'
import {
  validatePrerequisites,
  validatePrerequisiteOrder,
  validateCourseCombo,
  validateCourseDateOverlap,
  validateNoDuplicateCourses,
  validateStartDateNotInPast,
  calculateComboDates,
  getEndDateDefault,
  getUnavailableCodes,
  detectReferralWarnings,
} from '../src/lib/booking/course-validation'
import { testDate } from './helpers/dates'
import { addDays } from '../src/lib/utils/date'

// ── Prerequisite Warnings ─────────────────────────────────────────────────────

describe('validatePrerequisites', () => {
  it('no warning when AOW + OW both present', () => {
    const warnings = validatePrerequisites(['OW', 'AOW'])
    expect(warnings).toEqual([])
  })

  it('warns when AOW booked without OW', () => {
    const warnings = validatePrerequisites(['AOW'])
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toContain('Open Water')
  })

  it('warns when RESCUE booked without AOW', () => {
    const warnings = validatePrerequisites(['RESCUE'])
    expect(warnings.length).toBeGreaterThanOrEqual(1)
    expect(warnings.some((w) => w.toLowerCase().includes('advanced'))).toBe(true)
  })

  it('no warnings for courses with no prerequisites (OW, DSD)', () => {
    expect(validatePrerequisites(['OW'])).toEqual([])
    expect(validatePrerequisites(['DSD'])).toEqual([])
  })

  it('handles empty array', () => {
    expect(validatePrerequisites([])).toEqual([])
  })
})

// ── Prerequisite Ordering (hard errors) ──────────────────────────────────────

describe('validatePrerequisiteOrder', () => {
  it('no error when OW is before AOW', () => {
    const courses = [
      { activityCode: 'OW', dates: [testDate(5), testDate(7)] },
      { activityCode: 'AOW', dates: [testDate(8), testDate(9)] },
    ]
    expect(validatePrerequisiteOrder(courses)).toEqual([])
  })

  it('errors when AOW is before OW', () => {
    const courses = [
      { activityCode: 'AOW', dates: [testDate(5), testDate(6)] },
      { activityCode: 'OW', dates: [testDate(8), testDate(10)] },
    ]
    const errors = validatePrerequisiteOrder(courses)
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('Open Water')
    expect(errors[0]).toContain('before')
  })

  it('allows same start date (concurrent is ok)', () => {
    const courses = [
      { activityCode: 'OW', dates: [testDate(5), testDate(7)] },
      { activityCode: 'AOW', dates: [testDate(5), testDate(6)] },
    ]
    expect(validatePrerequisiteOrder(courses)).toEqual([])
  })

  it('errors when RESCUE is before AOW', () => {
    const courses = [
      { activityCode: 'RESCUE', dates: [testDate(5), testDate(7)] },
      { activityCode: 'AOW', dates: [testDate(8), testDate(9)] },
    ]
    const errors = validatePrerequisiteOrder(courses)
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('Advanced')
  })

  it('no error for courses with no prerequisites', () => {
    const courses = [
      { activityCode: 'DSD', dates: [testDate(8)] },
      { activityCode: 'OW', dates: [testDate(5), testDate(7)] },
    ]
    expect(validatePrerequisiteOrder(courses)).toEqual([])
  })

  it('handles single course', () => {
    const courses = [{ activityCode: 'AOW', dates: [testDate(5), testDate(6)] }]
    expect(validatePrerequisiteOrder(courses)).toEqual([])
  })

  it('handles empty array', () => {
    expect(validatePrerequisiteOrder([])).toEqual([])
  })

  it('catches positional ordering even when dates are absent', () => {
    const courses = [
      { activityCode: 'AOW', dates: [] },
      { activityCode: 'OW', dates: [testDate(5), testDate(7)] },
    ]
    const errors = validatePrerequisiteOrder(courses)
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('Advanced')
    expect(errors[0]).toContain('before')
  })
})

// ── Nonsensical Combos ──────────────────────────────────────────────────────

describe('validateCourseCombo', () => {
  it('flags DSD + AOW as nonsensical', () => {
    const warnings = validateCourseCombo(['DSD', 'AOW'])
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('allows DSD + OW (upgrade path not blocked in v1)', () => {
    const warnings = validateCourseCombo(['DSD', 'OW'])
    expect(warnings).toEqual([])
  })

  it('flags DSD + FD as nonsensical (FD requires OW cert, DSD is for non-certified)', () => {
    const warnings = validateCourseCombo(['DSD', 'FD'])
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('allows OW + AOW (normal progression)', () => {
    const warnings = validateCourseCombo(['OW', 'AOW'])
    expect(warnings).toEqual([])
  })

  it('allows single course', () => {
    expect(validateCourseCombo(['OW'])).toEqual([])
    expect(validateCourseCombo(['DSD'])).toEqual([])
  })

  it('handles empty array', () => {
    expect(validateCourseCombo([])).toEqual([])
  })
})

// ── Date Overlap Validation ─────────────────────────────────────────────────

describe('validateCourseDateOverlap', () => {
  it('returns no error when dates do not overlap', () => {
    const courses = [
      { activityCode: 'OW', dates: [testDate(5), testDate(7)] },
      { activityCode: 'AOW', dates: [testDate(8), testDate(9)] },
    ]
    expect(validateCourseDateOverlap(courses)).toEqual([])
  })

  it('flags true overlapping dates (mid-overlap)', () => {
    const courses = [
      { activityCode: 'OW', dates: [testDate(5), testDate(7)] },
      { activityCode: 'AOW', dates: [testDate(6), testDate(8)] },
    ]
    const errors = validateCourseDateOverlap(courses)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('allows shared transition day: OW [Mar 20, Mar 22] + AOW [Mar 22, Mar 23] → no error', () => {
    // B7: The O+A shared transition day is NOT overlap
    const courses = [
      { activityCode: 'OW', dates: [testDate(10), testDate(12)] },
      { activityCode: 'AOW', dates: [testDate(12), testDate(13)] },
    ]
    expect(validateCourseDateOverlap(courses)).toEqual([])
  })

  it('catches single-day course overlap: DSD [Mar 20] + OW [Mar 20, Mar 22] → error', () => {
    // B2: Single-date courses must still be overlap-checked
    const courses = [
      { activityCode: 'DSD', dates: [testDate(10)] },
      { activityCode: 'OW', dates: [testDate(10), testDate(12)] },
    ]
    const errors = validateCourseDateOverlap(courses)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('flags gap between O+A (not a shared transition day)', () => {
    // OW ends Mar 22, AOW starts Mar 24 — there's a gap, but no overlap error
    // This is actually allowed (gap is fine, just not ideal scheduling)
    const courses = [
      { activityCode: 'OW', dates: [testDate(10), testDate(12)] },
      { activityCode: 'AOW', dates: [testDate(14), testDate(15)] },
    ]
    expect(validateCourseDateOverlap(courses)).toEqual([])
  })

  it('flags AOW starting before OW ends (true overlap, not shared day)', () => {
    // OW [Mar 20, Mar 23], AOW [Mar 22, Mar 24] — AOW starts 2 days before OW ends
    const courses = [
      { activityCode: 'OW', dates: [testDate(10), testDate(13)] },
      { activityCode: 'AOW', dates: [testDate(12), testDate(14)] },
    ]
    const errors = validateCourseDateOverlap(courses)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('allows non-contiguous but non-overlapping dates', () => {
    const courses = [
      { activityCode: 'OW', dates: [testDate(5), testDate(7)] },
      { activityCode: 'AOW', dates: [testDate(10), testDate(11)] },
    ]
    expect(validateCourseDateOverlap(courses)).toEqual([])
  })

  it('returns empty for single course', () => {
    const courses = [
      { activityCode: 'OW', dates: [testDate(5), testDate(7)] },
    ]
    expect(validateCourseDateOverlap(courses)).toEqual([])
  })

  it('flags DSD [Mar 22] + OW [Mar 20, Mar 22] as overlap (not a combo transition)', () => {
    // Non-combo pair sharing an endpoint must NOT be exempted
    const courses = [
      { activityCode: 'DSD', dates: [testDate(12)] },
      { activityCode: 'OW', dates: [testDate(10), testDate(12)] },
    ]
    const errors = validateCourseDateOverlap(courses)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('skips entries with empty activityCode', () => {
    const courses = [
      { activityCode: '', dates: [testDate(10), testDate(12)] },
      { activityCode: 'OW', dates: [testDate(10), testDate(12)] },
    ]
    expect(validateCourseDateOverlap(courses)).toEqual([])
  })
})

// ── Duplicate Course Validation ─────────────────────────────────────────────

describe('validateNoDuplicateCourses', () => {
  it('OW + OW → error (duplicate)', () => {
    const errors = validateNoDuplicateCourses([
      { activityCode: 'OW' },
      { activityCode: 'OW' },
    ])
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('Duplicate')
  })

  it('OW + AOW → no error (different courses)', () => {
    const errors = validateNoDuplicateCourses([
      { activityCode: 'OW' },
      { activityCode: 'AOW' },
    ])
    expect(errors).toEqual([])
  })

  it('empty activityCode entries are skipped', () => {
    const errors = validateNoDuplicateCourses([
      { activityCode: '' },
      { activityCode: '' },
      { activityCode: 'OW' },
    ])
    expect(errors).toEqual([])
  })

  it('single entry → no error', () => {
    expect(validateNoDuplicateCourses([{ activityCode: 'OW' }])).toEqual([])
  })

  it('empty array → no error', () => {
    expect(validateNoDuplicateCourses([])).toEqual([])
  })
})


// ── O+A Combo Date Calculation ──────────────────────────────────────────────

describe('calculateComboDates', () => {
  it('OW [Mar 20, Mar 22], AOW [Mar 22, Mar 23] for start = Mar 20', () => {
    const result = calculateComboDates(testDate(10))
    expect(result.owDates).toEqual([testDate(10), testDate(12)])
    expect(result.aowDates).toEqual([testDate(12), testDate(13)])
  })

  it('total span is 4 days (Mar 20 through Mar 23)', () => {
    const result = calculateComboDates(testDate(10))
    // OW starts Mar 20, AOW ends Mar 23 → 4 calendar days
    expect(result.owDates[0]).toBe(testDate(10))
    expect(result.aowDates[1]).toBe(testDate(13))
  })

  it('shared transition day: OW end date === AOW start date', () => {
    const result = calculateComboDates(testDate(10))
    expect(result.owDates[1]).toBe(result.aowDates[0])
  })
})

// ── Past Start Date Validation ─────────────────────────────────────────────

describe('validateStartDateNotInPast', () => {
  const today = testDate(10)

  it('OW starting yesterday → error', () => {
    const errors = validateStartDateNotInPast(
      [{ activityCode: 'OW', dates: [testDate(9), testDate(11)] }],
      today,
    )
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain(testDate(9))
    expect(errors[0]).toContain('cannot start before today')
  })

  it('OW starting today → no error', () => {
    const errors = validateStartDateNotInPast(
      [{ activityCode: 'OW', dates: [testDate(10), testDate(12)] }],
      today,
    )
    expect(errors).toEqual([])
  })

  it('OW starting tomorrow → no error', () => {
    const errors = validateStartDateNotInPast(
      [{ activityCode: 'OW', dates: [testDate(11), testDate(13)] }],
      today,
    )
    expect(errors).toEqual([])
  })

  it('empty dates → skipped', () => {
    const errors = validateStartDateNotInPast(
      [{ activityCode: 'OW', dates: [] }],
      today,
    )
    expect(errors).toEqual([])
  })

  it('empty activityCode → skipped', () => {
    const errors = validateStartDateNotInPast(
      [{ activityCode: '', dates: [testDate(9)] }],
      today,
    )
    expect(errors).toEqual([])
  })
})

// ── End Date Defaults ───────────────────────────────────────────────────────

describe('getEndDateDefault', () => {
  it('OW: start + 2 days (3-day course)', () => {
    expect(getEndDateDefault('OW', testDate(5))).toBe(testDate(7))
  })

  it('OW from Mar 20 → Mar 22 (not Mar 23)', () => {
    // C3: Per BookingTestSpec 2d
    expect(getEndDateDefault('OW', testDate(10))).toBe(testDate(12))
  })

  it('AOW: start + 1 day (2-day course)', () => {
    expect(getEndDateDefault('AOW', testDate(5))).toBe(testDate(6))
  })

  it('AOW from Mar 22 → Mar 23', () => {
    expect(getEndDateDefault('AOW', testDate(12))).toBe(testDate(13))
  })

  it('DSD: same day (1-day course)', () => {
    expect(getEndDateDefault('DSD', testDate(5))).toBe(testDate(5))
  })

  it('returns start date for unknown course', () => {
    expect(getEndDateDefault('UNKNOWN', testDate(5))).toBe(testDate(5))
  })
})

// ── getUnavailableCodes ──────────────────────────────────────────────────────

function entries(...codes: string[]) {
  return codes.map((activityCode) => ({ activityCode }))
}

describe('getUnavailableCodes', () => {
  it('position 0 — nothing blocked (no prior entries)', () => {
    const unavailable = getUnavailableCodes(entries('OW'), 0)
    expect(unavailable.size).toBe(0)
  })

  it('DSD first → blocks cert courses except OW at position 2', () => {
    const unavailable = getUnavailableCodes(entries('DSD', ''), 1)
    expect(unavailable.has('AOW')).toBe(true)
    expect(unavailable.has('RESCUE')).toBe(true)
    expect(unavailable.has('DM')).toBe(true)
    expect(unavailable.has('FD')).toBe(true)
    expect(unavailable.has('REFRESH')).toBe(true)
    expect(unavailable.has('SPECIALTY')).toBe(true)
    expect(unavailable.has('OW')).toBe(false)   // OW still allowed after DSD
    expect(unavailable.has('DSD')).toBe(false)   // DSD is repeatable
  })

  it('TRY_DIVE first → same as DSD', () => {
    const unavailable = getUnavailableCodes(entries('TRY_DIVE', ''), 1)
    expect(unavailable.has('FD')).toBe(true)
    expect(unavailable.has('OW')).toBe(false)
  })

  it('OW first → blocks OW (non-rep dup) + DSD + TRY_DIVE (cert→intro)', () => {
    const unavailable = getUnavailableCodes(entries('OW', ''), 1)
    expect(unavailable.has('OW')).toBe(true)
    expect(unavailable.has('DSD')).toBe(true)
    expect(unavailable.has('TRY_DIVE')).toBe(true)
    expect(unavailable.has('AOW')).toBe(false)
  })

  it('AOW first → blocks AOW (dup) + OW (ordering) + DSD + TRY_DIVE', () => {
    const unavailable = getUnavailableCodes(entries('AOW', ''), 1)
    expect(unavailable.has('AOW')).toBe(true)
    expect(unavailable.has('OW')).toBe(true)
    expect(unavailable.has('DSD')).toBe(true)
    expect(unavailable.has('TRY_DIVE')).toBe(true)
    expect(unavailable.has('RESCUE')).toBe(false)
  })

  it('RESCUE first → blocks RESCUE (dup) + AOW (ordering) + DSD + TRY_DIVE', () => {
    const unavailable = getUnavailableCodes(entries('RESCUE', ''), 1)
    expect(unavailable.has('RESCUE')).toBe(true)
    expect(unavailable.has('AOW')).toBe(true)
    expect(unavailable.has('DSD')).toBe(true)
    expect(unavailable.has('DM')).toBe(false)
  })

  it('DM first → blocks DM (dup) + RESCUE (ordering) + DSD + TRY_DIVE', () => {
    const unavailable = getUnavailableCodes(entries('DM', ''), 1)
    expect(unavailable.has('DM')).toBe(true)
    expect(unavailable.has('RESCUE')).toBe(true)
    expect(unavailable.has('DSD')).toBe(true)
  })

  it('FD first → blocks DSD + TRY_DIVE; FD itself NOT blocked (repeatable)', () => {
    const unavailable = getUnavailableCodes(entries('FD', ''), 1)
    expect(unavailable.has('DSD')).toBe(true)
    expect(unavailable.has('TRY_DIVE')).toBe(true)
    expect(unavailable.has('FD')).toBe(false)
    expect(unavailable.has('OW')).toBe(true)   // ordering: OW is prereq of FD
  })

  it('REFRESH first → blocks OW (dup) + DSD + TRY_DIVE', () => {
    const unavailable = getUnavailableCodes(entries('REFRESH', ''), 1)
    expect(unavailable.has('OW')).toBe(true)
    expect(unavailable.has('DSD')).toBe(true)
    expect(unavailable.has('REFRESH')).toBe(true) // non-repeatable dup
  })

  it('SPECIALTY first → blocks OW (ordering) + DSD + TRY_DIVE; SPECIALTY NOT blocked (repeatable)', () => {
    const unavailable = getUnavailableCodes(entries('SPECIALTY', ''), 1)
    expect(unavailable.has('OW')).toBe(true)
    expect(unavailable.has('DSD')).toBe(true)
    expect(unavailable.has('TRY_DIVE')).toBe(true)
    expect(unavailable.has('SPECIALTY')).toBe(false)
  })

  it('[OW, AOW] at index 2 → blocks OW + AOW (dups) + OW (prereq of AOW)', () => {
    const unavailable = getUnavailableCodes(entries('OW', 'AOW', ''), 2)
    expect(unavailable.has('OW')).toBe(true)
    expect(unavailable.has('AOW')).toBe(true)
    expect(unavailable.has('RESCUE')).toBe(false)
    expect(unavailable.has('DSD')).toBe(true)
  })
})

// ── detectReferralWarnings ────────────────────────────────────────────────────

describe('detectReferralWarnings', () => {
  it('warns when OW starts from dive 2 (skipping Confined and OW 1)', () => {
    const dives = [{ courseCode: 'OW', diveNumber: 2, isConfined: false }]
    const warnings = detectReferralWarnings(dives, ['OW'])
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toMatch(/Starting dive 2.*referral/i)
  })

  it('warns when OW starts from OW 1 (skipping Confined)', () => {
    const dives = [{ courseCode: 'OW', diveNumber: 1, isConfined: false }]
    const warnings = detectReferralWarnings(dives, ['OW'])
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toMatch(/Starting dive 1.*referral/i)
  })

  it('warns when AOW starts from dive 3 (skipping AOW 1-2)', () => {
    const dives = [{ courseCode: 'AOW', diveNumber: 3, isConfined: false }]
    const warnings = detectReferralWarnings(dives, ['AOW'])
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toMatch(/Starting dive 3.*referral/i)
  })

  it('no warning when OW starts from Confined (the true beginning)', () => {
    const dives = [{ courseCode: 'OW', diveNumber: 0, isConfined: true }]
    const warnings = detectReferralWarnings(dives, ['OW'])
    expect(warnings.length).toBe(0)
  })

  it('no warning when AOW starts from dive 1', () => {
    const dives = [{ courseCode: 'AOW', diveNumber: 1, isConfined: false }]
    const warnings = detectReferralWarnings(dives, ['AOW'])
    expect(warnings.length).toBe(0)
  })

  it('no warning when no dives placed yet', () => {
    const warnings = detectReferralWarnings([], ['OW'])
    expect(warnings.length).toBe(0)
  })
})
