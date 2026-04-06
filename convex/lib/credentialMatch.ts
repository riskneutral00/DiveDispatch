/**
 * Pure credential-matching logic for instructor/course validation.
 * No DB calls — takes credential data and course codes, returns match result.
 */

import type { CourseCode } from '../shared/courseCodes'

export type Credential = {
  agency: string
  level: string
  agencyID: string
  specialtyRatings: string[]
}

export type CredentialMatchResult = {
  canTeach: boolean
  missing: CourseCode[]
}

/**
 * Courses that any certified instructor can lead — no specific course entry needed.
 * DSD/TRY_DIVE/FD/REFRESH are intro/refresher activities, not certification courses.
 */
const UNIVERSAL_COURSES: ReadonlySet<string> = new Set([
  'DSD',
  'TRY_DIVE',
  'FD',
  'REFRESH',
])

/**
 * Check whether an instructor's credentials cover all required courses.
 *
 * An instructor can teach a course if ANY of their credentials includes
 * that course in its `specialtyRatings` array.
 *
 * Universal courses (DSD, TRY_DIVE, FD, REFRESH) are always considered
 * teachable by any certified instructor — they don't require an explicit
 * entry in credential[].specialtyRatings.
 */
export function canTeachCourses(
  credentials: Credential[],
  requiredCourses: CourseCode[],
): CredentialMatchResult {
  if (requiredCourses.length === 0) {
    return { canTeach: true, missing: [] }
  }

  // Build set of all courses this instructor can teach
  const teachable = new Set<string>()
  for (const cred of credentials) {
    for (const course of cred.specialtyRatings) {
      teachable.add(course)
    }
  }

  const missing: CourseCode[] = []
  for (const course of requiredCourses) {
    // Universal courses never require explicit credential entry
    if (UNIVERSAL_COURSES.has(course)) continue
    // Explicit courses require a matching entry
    if (!teachable.has(course)) {
      missing.push(course)
    }
  }

  return {
    canTeach: missing.length === 0,
    missing,
  }
}
