import type { CourseCode } from '@/lib/constants/course-catalog'

export const CERT_REQUIRED_ACTIVITIES = [
  'AOW',
  'RESCUE',
  'DM',
  'FD',
  'REFRESH',
  'SPECIALTY',
] as const satisfies readonly CourseCode[]

export const NO_CERT_ACTIVITIES = ['DSD', 'TRY_DIVE', 'OW'] as const satisfies readonly CourseCode[]

export const INSTRUCTOR_REQUIRED_CODES = [
  'DSD', 'TRY_DIVE', 'OW', 'AOW', 'RESCUE', 'DM', 'REFRESH', 'SPECIALTY',
] as const satisfies readonly CourseCode[]

export const CONFINED_ACTIVITY_CODES = [
  'DSD', 'TRY_DIVE', 'OW', 'REFRESH',
] as const satisfies readonly CourseCode[]

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

export function requiresCertification(activityTypes: readonly string[]): boolean {
  return activityTypes.some((t) =>
    (CERT_REQUIRED_ACTIVITIES as readonly string[]).includes(t),
  )
}

export function getMinAge(activityTypes: readonly CourseCode[]): number {
  if (activityTypes.length === 0) return 0
  return Math.max(...activityTypes.map((t) => ACTIVITY_MIN_AGE[t] ?? 0))
}

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

export function isPassportExpiringSoon(dateStr: string, referenceDate?: string): boolean {
  if (!dateStr) return false
  const expiry = new Date(dateStr)
  const ref = referenceDate ? new Date(referenceDate) : new Date()
  const sixMonthsFromRef = new Date(ref)
  sixMonthsFromRef.setMonth(sixMonthsFromRef.getMonth() + 6)
  return expiry <= sixMonthsFromRef
}
