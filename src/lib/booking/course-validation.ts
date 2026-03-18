// ── Course Validation ─────────────────────────────────────────────────────────
// Pure validation logic for course selection in the booking wizard.
// No Convex, no React deps.

import { getCourseByCode, type CourseCode } from '@/lib/constants/course-catalog'
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

      if (a.dates.length < 2 || b.dates.length < 2) continue

      const aStart = a.dates[0]
      const aEnd = a.dates[1]
      const bStart = b.dates[0]
      const bEnd = b.dates[1]

      // Overlap: A starts before B ends AND B starts before A ends
      if (aStart <= bEnd && bStart <= aEnd) {
        errors.push(
          `${a.activityCode} (${aStart}–${aEnd}) overlaps with ${b.activityCode} (${bStart}–${bEnd}).`,
        )
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
