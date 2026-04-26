export const HOUR_MS = 60 * 60 * 1000
export const DAY_MS = 24 * HOUR_MS

export const BOOKING_LINK_TTL_MS = 30 * DAY_MS

export const NOSHOW_REVERT_WINDOW_MS = 24 * HOUR_MS

export const MEDICAL_TTL_MS = 36 * HOUR_MS

export const MIN_SIGNUP_AGE_YEARS = 18

export function ageInYears(isoDate: string, now: Date = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return NaN
  const [y, m, d] = isoDate.split('-').map(Number)
  let age = now.getUTCFullYear() - y
  const mDiff = now.getUTCMonth() + 1 - m
  if (mDiff < 0 || (mDiff === 0 && now.getUTCDate() < d)) age--
  return age
}

export function isAdult(isoDate: string, now: Date = new Date()): boolean {
  return ageInYears(isoDate, now) >= MIN_SIGNUP_AGE_YEARS
}
