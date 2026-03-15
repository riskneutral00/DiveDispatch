// ── Activity Rules ────────────────────────────────────────────────────────────
// Shared constants for certification requirements and PADI age minimums.
// Used by booking wizard, customer portal validation, and server-side checks.

import type { CourseCode } from '@/lib/constants/course-catalog'

// Activities that require the diver to hold a pre-existing certification.
// If ANY of a diver's activityTypes is in this list, agency + agencyID are required.
export const CERT_REQUIRED_ACTIVITIES = [
  'AOW',
  'RESCUE',
  'DM',
  'FD',
  'REFRESH',
  'SPECIALTY',
] as const satisfies readonly CourseCode[]

// Activities that do NOT require a pre-existing certification.
export const NO_CERT_ACTIVITIES = ['DSD', 'TRY_DIVE', 'OW'] as const satisfies readonly CourseCode[]

// PADI/universal age minimums per activity.
// Age is calculated against booking startDate (not Date.now()).
export const ACTIVITY_MIN_AGE: Record<CourseCode, number> = {
  DSD: 10,
  TRY_DIVE: 10,
  OW: 10,
  AOW: 12,
  RESCUE: 12,
  DM: 18,
  FD: 10,
  REFRESH: 10,
  SPECIALTY: 12,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if any activity in the list requires a pre-existing certification.
 */
export function requiresCertification(activityTypes: readonly string[]): boolean {
  return activityTypes.some((t) =>
    (CERT_REQUIRED_ACTIVITIES as readonly string[]).includes(t),
  )
}

/**
 * Returns the minimum age required across all activity types for a diver.
 * Returns the highest minimum in the list (most restrictive).
 */
export function getMinAge(activityTypes: readonly CourseCode[]): number {
  if (activityTypes.length === 0) return 0
  return Math.max(...activityTypes.map((t) => ACTIVITY_MIN_AGE[t] ?? 0))
}

/**
 * Calculates age in years from dateOfBirth (YYYY-MM-DD) relative to a reference date.
 * Used to determine whether guardian signature is required and for age-minimum checks.
 */
export function calcAgeAtDate(dateOfBirth: string, referenceDate: string): number {
  const dob = new Date(dateOfBirth)
  const ref = new Date(referenceDate)
  let age = ref.getFullYear() - dob.getFullYear()
  const monthDiff = ref.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
    age -= 1
  }
  return age
}
