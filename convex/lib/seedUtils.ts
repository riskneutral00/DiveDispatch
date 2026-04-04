/**
 * Shared date utilities and constants for seed/demo data generators.
 * Used by seedBookingData.ts and demoBookings.ts.
 */

/** Format a date as YYYY-MM-DD. */
export function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Add (or subtract) days from a YYYY-MM-DD string, returning YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return dateStr(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

/** Course code → duration in days. */
export const COURSE_DURATIONS: Record<string, number> = {
  DSD: 1,
  TRY_DIVE: 1,
  OW: 3,
  AOW: 2,
  FD: 1,
  RESCUE: 3,
  DM: 5,
  REFRESH: 1,
  SPECIALTY: 2,
}
