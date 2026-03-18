// ── Date Utilities ───────────────────────────────────────────────────────────
// Pure date helpers — no framework deps.

export const MS_PER_DAY = 86_400_000

/** Difference in calendar days between two ISO date strings (a - b). */
export function diffDays(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00')
  const b = new Date(dateB + 'T00:00:00')
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY)
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

/** Get all ISO date strings in a range (inclusive). */
export function getDatesInRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return []

  const dates: string[] = []
  const current = new Date(start)
  while (current <= end) {
    dates.push(toISODateString(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

/** Format ISO date string to short display (e.g. "Mon, Mar 16"). */
export function formatDateShort(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
