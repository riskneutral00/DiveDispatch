// ── Date Utilities ───────────────────────────────────────────────────────────
// Pure date helpers — no framework deps.
// getDatesInRange and parseDateLocal are canonical in convex/shared/dateRange.ts
// and re-exported here for client convenience.

import { DAY_MS } from '@/lib/constants/time'

export { getDatesInRange, parseDateLocal } from '../../../convex/shared/dateRange'

/** Alias for `DAY_MS` — same source as convex/lib/timeConstants. */
export const MS_PER_DAY = DAY_MS

/** Difference in calendar days between two ISO date strings (a - b). */
export function diffDays(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00')
  const b = new Date(dateB + 'T00:00:00')
  return Math.round((a.getTime() - b.getTime()) / DAY_MS)
}

/** Convert a Date object to "YYYY-MM-DD" ISO date string (local time). */
export function toISODateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Add N days to an ISO date string, returning an ISO date string. */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + days)
  return toISODateString(date)
}

/** Format ISO date string to short display (e.g. "Mon, Mar 16"). Uses browser locale by default. */
export function formatDateShort(dateStr: string, locale?: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
