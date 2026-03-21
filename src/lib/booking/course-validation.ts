// ── Course Validation ─────────────────────────────────────────────────────────
// Pure validation logic for course selection in the booking wizard.
// No Convex, no React deps.

import { getCourseByCode, type CourseCode, COMBO_COURSES } from '@/lib/constants/course-catalog'
import { addDays } from '@/lib/utils/date'

/**
 * Soft prerequisite warnings.
 * Returns warning messages when a course is booked without its prerequisites
 * present in the same booking. These are soft — operator can proceed.
 */
export function validatePrerequisites(courseCodes: string[]): string[] {
  const warnings: string[] = []
  const codeSet = new Set(courseCodes)

  for (const code of courseCodes) {
    const course = getCourseByCode(code as CourseCode)
    if (!course?.prerequisites?.length) continue

    for (const prereq of course.prerequisites) {
      if (!codeSet.has(prereq)) {
        const prereqCourse = getCourseByCode(prereq as CourseCode)
        const prereqName = prereqCourse?.name ?? prereq
        warnings.push(
          `${course.name} requires ${prereqName} certification. Proof will be required.`,
        )
      }
    }
  }

  return warnings
}

/**
 * Flags nonsensical course combinations.
 * DSD is an intro dive — combining with certification courses makes no sense.
 */
export function validateCourseCombo(courseCodes: string[]): string[] {
  if (courseCodes.length < 2) return []

  const warnings: string[] = []
  const hasDSD = courseCodes.includes('DSD') || courseCodes.includes('TRY_DIVE')
  const certCourses = courseCodes.filter(
    (c) => c !== 'DSD' && c !== 'TRY_DIVE' && c !== 'FD' && c !== 'REFRESH',
  )

  if (hasDSD && certCourses.length > 0) {
    warnings.push(
      `Discover Scuba + ${certCourses.join(', ')} doesn't make sense. DSD is for non-divers trying scuba once.`,
    )
  }

  return warnings
}

/**
 * Hard rule: prerequisite courses must come before dependent courses in date order.
 * Unlike validatePrerequisites (soft warning about missing prereqs), this is a hard
 * error when both courses are present but in wrong chronological order.
 */
export function validatePrerequisiteOrder(
  courses: { activityCode: string; dates: string[] }[],
): string[] {
  if (courses.length < 2) return []

  const errors: string[] = []

  for (const entry of courses) {
    if (!entry.activityCode || entry.dates.length < 1) continue

    const course = getCourseByCode(entry.activityCode as CourseCode)
    if (!course?.prerequisites?.length) continue

    const entryStart = entry.dates[0]

    for (const prereqCode of course.prerequisites) {
      const prereqEntry = courses.find(
        (c) => c.activityCode === prereqCode && c !== entry && c.dates.length >= 1,
      )
      if (!prereqEntry) continue

      // Prereq must start before (or same day as) the dependent course
      const prereqStart = prereqEntry.dates[0]
      if (prereqStart > entryStart) {
        const prereqCourse = getCourseByCode(prereqCode as CourseCode)
        const prereqName = prereqCourse?.name ?? prereqCode
        errors.push(
          `${prereqName} must be scheduled before ${course.name} — move ${prereqName} earlier.`,
        )
      }
    }
  }

  return errors
}

/**
 * Hard rule: same-diver courses cannot overlap in dates.
 * Checks start/end date ranges for overlap between course entries.
 */
export function validateCourseDateOverlap(
  courses: { activityCode: string; dates: string[] }[],
): string[] {
  if (courses.length < 2) return []

  const errors: string[] = []

  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      const a = courses[i]
      const b = courses[j]

      // Skip entries with no activity code or no dates
      if (!a.activityCode || !b.activityCode) continue
      if (a.dates.length < 1 || b.dates.length < 1) continue

      // Treat single-date entries as [date, date]
      const aStart = a.dates[0]
      const aEnd = a.dates[1] ?? a.dates[0]
      const bStart = b.dates[0]
      const bEnd = b.dates[1] ?? b.dates[0]

      // Inclusive overlap check
      if (aStart <= bEnd && bStart <= aEnd) {
        // Exempt shared transition day ONLY for recognized combo courses (e.g. O+A).
        // OW [Mar 20, Mar 22] + AOW [Mar 22, Mar 23] → exempted (combo transition day).
        // DSD [Mar 22] + OW [Mar 20, Mar 22] → NOT exempted (not a combo pair).
        const isComboTransition = isRecognizedComboTransition(
          a.activityCode, aEnd, b.activityCode, bStart,
        ) || isRecognizedComboTransition(
          b.activityCode, bEnd, a.activityCode, aStart,
        )
        if (!isComboTransition) {
          errors.push(
            `${a.activityCode} (${aStart}–${aEnd}) overlaps with ${b.activityCode} (${bStart}–${bEnd}).`,
          )
        }
      }
    }
  }

  return errors
}

/**
 * Returns the default end date for a course given a start date.
 * Based on course catalog minDays (which represents the default duration).
 */
export function getEndDateDefault(courseCode: string, startDate: string): string {
  const course = getCourseByCode(courseCode as CourseCode)
  if (!course) return startDate
  const days = course.minDays
  if (days <= 1) return startDate
  return addDays(startDate, days - 1)
}

/**
 * Hard rule: no duplicate course codes for the same customer.
 * Same customer can't take OW twice in one booking.
 * Empty activityCodes are skipped.
 */
export function validateNoDuplicateCourses(
  courses: { activityCode: string }[],
): string[] {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const entry of courses) {
    if (!entry.activityCode) continue
    if (seen.has(entry.activityCode)) {
      const course = getCourseByCode(entry.activityCode as CourseCode)
      const name = course?.name ?? entry.activityCode
      errors.push(`Duplicate course: ${name} appears more than once.`)
    }
    seen.add(entry.activityCode)
  }

  return errors
}

/**
 * Hard rule: prerequisite course must be present in the same booking.
 * Unlike validatePrerequisites (soft warning about needing proof of certification),
 * this blocks advancement when a required course is completely missing from entries.
 */
export function validateMissingPrerequisites(
  courseCodes: string[],
): string[] {
  const errors: string[] = []
  const codeSet = new Set(courseCodes.filter(Boolean))

  for (const code of codeSet) {
    const course = getCourseByCode(code as CourseCode)
    if (!course?.prerequisites?.length) continue

    for (const prereq of course.prerequisites) {
      if (!codeSet.has(prereq)) {
        const prereqCourse = getCourseByCode(prereq as CourseCode)
        const prereqName = prereqCourse?.name ?? prereq
        errors.push(
          `${course.name} requires ${prereqName} — add it to the booking or remove ${course.name}.`,
        )
      }
    }
  }

  return errors
}

/**
 * Returns true only when the boundary touch (endA === startB) is between two
 * courses that form a recognized combo pair (e.g. OW → AOW in O+A).
 * This prevents the overlap exemption from firing for arbitrary course pairs
 * that happen to share an endpoint (e.g. DSD + OW).
 */
function isRecognizedComboTransition(
  codeA: string, endA: string, codeB: string, startB: string,
): boolean {
  if (endA !== startB) return false
  return Object.values(COMBO_COURSES).some(
    (combo) => combo.codes[0] === codeA && combo.codes[1] === codeB,
  )
}

/**
 * Hard rule: course start dates cannot be in the past.
 * Returns error messages for any course entry whose first date is before today.
 */
export function validateStartDateNotInPast(
  courses: { activityCode: string; dates: string[] }[],
  today: string,
): string[] {
  const errors: string[] = []

  for (const entry of courses) {
    if (!entry.activityCode || entry.dates.length === 0) continue
    if (entry.dates[0] < today) {
      const course = getCourseByCode(entry.activityCode as CourseCode)
      const name = course?.name ?? entry.activityCode
      errors.push(`${name} starts ${entry.dates[0]} — cannot start before today.`)
    }
  }

  return errors
}

/**
 * Calculate correct date ranges for the O+A combo.
 * OW gets [start, owEnd] where owEnd = start + minDays(OW) - 1.
 * AOW gets [owEnd, aowEnd] where aowEnd = owEnd + minDays(AOW) - 1.
 * The shared transition day (owEnd) is where OW dives end and AOW dives begin.
 */
export function calculateComboDates(
  startDate: string,
): { owDates: [string, string]; aowDates: [string, string] } {
  const owEnd = getEndDateDefault('OW', startDate)
  const aowEnd = getEndDateDefault('AOW', owEnd)
  return {
    owDates: [startDate, owEnd],
    aowDates: [owEnd, aowEnd],
  }
}
