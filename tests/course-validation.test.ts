import { describe, it, expect } from 'vitest'
import {
  validatePrerequisites,
  validatePrerequisiteOrder,
  validateCourseCombo,
  validateCourseDateOverlap,
  validateNoDuplicateCourses,
  validateMissingPrerequisites,
  validateStartDateNotInPast,
  calculateComboDates,
  getEndDateDefault,
} from '../src/lib/booking/course-validation'

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
      { activityCode: 'OW', dates: ['2026-03-15', '2026-03-17'] },
      { activityCode: 'AOW', dates: ['2026-03-18', '2026-03-19'] },
    ]
    expect(validatePrerequisiteOrder(courses)).toEqual([])
  })

  it('errors when AOW is before OW', () => {
    const courses = [
      { activityCode: 'AOW', dates: ['2026-03-15', '2026-03-16'] },
      { activityCode: 'OW', dates: ['2026-03-18', '2026-03-20'] },
    ]
    const errors = validatePrerequisiteOrder(courses)
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('Open Water')
    expect(errors[0]).toContain('before')
  })

  it('allows same start date (concurrent is ok)', () => {
    const courses = [
      { activityCode: 'OW', dates: ['2026-03-15', '2026-03-17'] },
      { activityCode: 'AOW', dates: ['2026-03-15', '2026-03-16'] },
    ]
    expect(validatePrerequisiteOrder(courses)).toEqual([])
  })

  it('errors when RESCUE is before AOW', () => {
    const courses = [
      { activityCode: 'RESCUE', dates: ['2026-03-15', '2026-03-17'] },
      { activityCode: 'AOW', dates: ['2026-03-18', '2026-03-19'] },
    ]
    const errors = validatePrerequisiteOrder(courses)
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('Advanced')
  })

  it('no error for courses with no prerequisites', () => {
    const courses = [
      { activityCode: 'DSD', dates: ['2026-03-18'] },
      { activityCode: 'OW', dates: ['2026-03-15', '2026-03-17'] },
    ]
    expect(validatePrerequisiteOrder(courses)).toEqual([])
  })

  it('handles single course', () => {
    const courses = [{ activityCode: 'AOW', dates: ['2026-03-15', '2026-03-16'] }]
    expect(validatePrerequisiteOrder(courses)).toEqual([])
  })

  it('handles empty array', () => {
    expect(validatePrerequisiteOrder([])).toEqual([])
  })

  it('skips entries with no dates', () => {
    const courses = [
      { activityCode: 'AOW', dates: [] },
      { activityCode: 'OW', dates: ['2026-03-15', '2026-03-17'] },
    ]
    expect(validatePrerequisiteOrder(courses)).toEqual([])
  })
})

// ── Nonsensical Combos ──────────────────────────────────────────────────────

describe('validateCourseCombo', () => {
  it('flags DSD + AOW as nonsensical', () => {
    const warnings = validateCourseCombo(['DSD', 'AOW'])
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('flags DSD + OW as nonsensical', () => {
    const warnings = validateCourseCombo(['DSD', 'OW'])
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
      { activityCode: 'OW', dates: ['2026-03-15', '2026-03-17'] },
      { activityCode: 'AOW', dates: ['2026-03-18', '2026-03-19'] },
    ]
    expect(validateCourseDateOverlap(courses)).toEqual([])
  })

  it('flags true overlapping dates (mid-overlap)', () => {
    const courses = [
      { activityCode: 'OW', dates: ['2026-03-15', '2026-03-17'] },
      { activityCode: 'AOW', dates: ['2026-03-16', '2026-03-18'] },
    ]
    const errors = validateCourseDateOverlap(courses)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('allows shared transition day: OW [Mar 20, Mar 22] + AOW [Mar 22, Mar 23] → no error', () => {
    // B7: The O+A shared transition day is NOT overlap
    const courses = [
      { activityCode: 'OW', dates: ['2026-03-20', '2026-03-22'] },
      { activityCode: 'AOW', dates: ['2026-03-22', '2026-03-23'] },
    ]
    expect(validateCourseDateOverlap(courses)).toEqual([])
  })

  it('catches single-day course overlap: DSD [Mar 20] + OW [Mar 20, Mar 22] → error', () => {
    // B2: Single-date courses must still be overlap-checked
    const courses = [
      { activityCode: 'DSD', dates: ['2026-03-20'] },
      { activityCode: 'OW', dates: ['2026-03-20', '2026-03-22'] },
    ]
    const errors = validateCourseDateOverlap(courses)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('allows non-contiguous but non-overlapping dates', () => {
    const courses = [
      { activityCode: 'OW', dates: ['2026-03-15', '2026-03-17'] },
      { activityCode: 'AOW', dates: ['2026-03-20', '2026-03-21'] },
    ]
    expect(validateCourseDateOverlap(courses)).toEqual([])
  })

  it('returns empty for single course', () => {
    const courses = [
      { activityCode: 'OW', dates: ['2026-03-15', '2026-03-17'] },
    ]
    expect(validateCourseDateOverlap(courses)).toEqual([])
  })

  it('flags DSD [Mar 22] + OW [Mar 20, Mar 22] as overlap (not a combo transition)', () => {
    // Non-combo pair sharing an endpoint must NOT be exempted
    const courses = [
      { activityCode: 'DSD', dates: ['2026-03-22'] },
      { activityCode: 'OW', dates: ['2026-03-20', '2026-03-22'] },
    ]
    const errors = validateCourseDateOverlap(courses)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('skips entries with empty activityCode', () => {
    const courses = [
      { activityCode: '', dates: ['2026-03-20', '2026-03-22'] },
      { activityCode: 'OW', dates: ['2026-03-20', '2026-03-22'] },
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

// ── Missing Prerequisite (hard error) ───────────────────────────────────────

describe('validateMissingPrerequisites', () => {
  it('AOW alone → error (OW missing)', () => {
    const errors = validateMissingPrerequisites(['AOW'])
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('Open Water')
  })

  it('OW + AOW → no error (prereq present)', () => {
    const errors = validateMissingPrerequisites(['OW', 'AOW'])
    expect(errors).toEqual([])
  })

  it('OW alone → no error (no prereqs)', () => {
    expect(validateMissingPrerequisites(['OW'])).toEqual([])
  })

  it('RESCUE alone → error (AOW missing)', () => {
    const errors = validateMissingPrerequisites(['RESCUE'])
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors.some((e) => e.toLowerCase().includes('advanced'))).toBe(true)
  })

  it('empty codes are filtered out', () => {
    const errors = validateMissingPrerequisites(['', 'OW', ''])
    expect(errors).toEqual([])
  })

  it('orphaned after delete: had OW+AOW, removed OW → error on AOW', () => {
    // Simulates: user had OW + AOW, then deleted the OW entry
    const errors = validateMissingPrerequisites(['AOW'])
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('Open Water')
  })
})

// ── O+A Combo Date Calculation ──────────────────────────────────────────────

describe('calculateComboDates', () => {
  it('OW [Mar 20, Mar 22], AOW [Mar 22, Mar 23] for start = Mar 20', () => {
    const result = calculateComboDates('2026-03-20')
    expect(result.owDates).toEqual(['2026-03-20', '2026-03-22'])
    expect(result.aowDates).toEqual(['2026-03-22', '2026-03-23'])
  })

  it('total span is 4 days (Mar 20 through Mar 23)', () => {
    const result = calculateComboDates('2026-03-20')
    // OW starts Mar 20, AOW ends Mar 23 → 4 calendar days
    expect(result.owDates[0]).toBe('2026-03-20')
    expect(result.aowDates[1]).toBe('2026-03-23')
  })

  it('shared transition day: OW end date === AOW start date', () => {
    const result = calculateComboDates('2026-03-20')
    expect(result.owDates[1]).toBe(result.aowDates[0])
  })
})

// ── Past Start Date Validation ─────────────────────────────────────────────

describe('validateStartDateNotInPast', () => {
  const today = '2026-03-20'

  it('OW starting yesterday → error', () => {
    const errors = validateStartDateNotInPast(
      [{ activityCode: 'OW', dates: ['2026-03-19', '2026-03-21'] }],
      today,
    )
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('2026-03-19')
    expect(errors[0]).toContain('cannot start before today')
  })

  it('OW starting today → no error', () => {
    const errors = validateStartDateNotInPast(
      [{ activityCode: 'OW', dates: ['2026-03-20', '2026-03-22'] }],
      today,
    )
    expect(errors).toEqual([])
  })

  it('OW starting tomorrow → no error', () => {
    const errors = validateStartDateNotInPast(
      [{ activityCode: 'OW', dates: ['2026-03-21', '2026-03-23'] }],
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
      [{ activityCode: '', dates: ['2026-03-19'] }],
      today,
    )
    expect(errors).toEqual([])
  })
})

// ── End Date Defaults ───────────────────────────────────────────────────────

describe('getEndDateDefault', () => {
  it('OW: start + 2 days (3-day course)', () => {
    expect(getEndDateDefault('OW', '2026-03-15')).toBe('2026-03-17')
  })

  it('OW from Mar 20 → Mar 22 (not Mar 23)', () => {
    // C3: Per BookingTestSpec 2d
    expect(getEndDateDefault('OW', '2026-03-20')).toBe('2026-03-22')
  })

  it('AOW: start + 1 day (2-day course)', () => {
    expect(getEndDateDefault('AOW', '2026-03-15')).toBe('2026-03-16')
  })

  it('AOW from Mar 22 → Mar 23', () => {
    expect(getEndDateDefault('AOW', '2026-03-22')).toBe('2026-03-23')
  })

  it('DSD: same day (1-day course)', () => {
    expect(getEndDateDefault('DSD', '2026-03-15')).toBe('2026-03-15')
  })

  it('returns start date for unknown course', () => {
    expect(getEndDateDefault('UNKNOWN', '2026-03-15')).toBe('2026-03-15')
  })
})
