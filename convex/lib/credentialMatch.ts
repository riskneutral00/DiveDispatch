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

const UNIVERSAL_COURSES: ReadonlySet<string> = new Set([
  'DSD',
  'TRY_DIVE',
  'FD',
  'REFRESH',
])

export function canTeachCourses(
  credentials: Credential[],
  requiredCourses: CourseCode[],
): CredentialMatchResult {
  if (requiredCourses.length === 0) {
    return { canTeach: true, missing: [] }
  }

  const teachable = new Set<string>()
  for (const cred of credentials) {
    for (const course of cred.specialtyRatings) {
      teachable.add(course)
    }
  }

  const missing: CourseCode[] = []
  for (const course of requiredCourses) {
    if (UNIVERSAL_COURSES.has(course)) continue
    if (!teachable.has(course)) {
      missing.push(course)
    }
  }

  return {
    canTeach: missing.length === 0,
    missing,
  }
}
