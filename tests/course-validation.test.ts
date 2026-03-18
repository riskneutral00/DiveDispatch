import { describe, it, expect } from 'vitest'
import {
  validatePrerequisites,
  validatePrerequisiteOrder,
  validateCourseCombo,
  validateCourseDateOverlap,
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

// ── Sequential Date Validation ──────────────────────────────────────────────

describe('validateCourseDateOverlap', () => {
  it('returns no error when dates do not overlap', () => {
    const courses = [
      { activityCode: 'OW', dates: ['2026-03-15', '2026-03-17'] },
      { activityCode: 'AOW', dates: ['2026-03-18', '2026-03-19'] },
    ]
    expect(validateCourseDateOverlap(courses)).toEqual([])
  })

  it('flags overlapping dates for same diver', () => {
    const courses = [
      { activityCode: 'OW', dates: ['2026-03-15', '2026-03-17'] },
      { activityCode: 'AOW', dates: ['2026-03-16', '2026-03-18'] }, // overlaps!
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
})

// ── End Date Defaults ───────────────────────────────────────────────────────

describe('getEndDateDefault', () => {
  it('OW: start + 2 days (3-day course, default)', () => {
    const end = getEndDateDefault('OW', '2026-03-15')
    expect(end).toBe('2026-03-17')
  })

  it('AOW: start + 1 day (2-day course)', () => {
    const end = getEndDateDefault('AOW', '2026-03-15')
    expect(end).toBe('2026-03-16')
  })

  it('DSD: same day (1-day course)', () => {
    const end = getEndDateDefault('DSD', '2026-03-15')
    expect(end).toBe('2026-03-15')
  })

  it('returns start date for unknown course', () => {
    const end = getEndDateDefault('UNKNOWN', '2026-03-15')
    expect(end).toBe('2026-03-15')
  })
})
