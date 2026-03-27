/**
 * Canonical date range expansion.
 * Pure function — no framework dependencies. Lives in convex/shared/ so both
 * server (convex/) and client (src/lib/) can import without violating the
 * dependency direction rule.
 */

/**
 * Generate an inclusive array of ISO date strings (YYYY-MM-DD) from startDate
 * to endDate. Returns [] for empty/invalid/reversed inputs.
 */
export function getDatesInRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return []

  const dates: string[] = []
  const current = new Date(start)
  while (current <= end) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    current.setDate(current.getDate() + 1)
  }
  return dates
}

/**
 * Parse "YYYY-MM-DD" as local midnight. Avoids UTC-shift from `new Date(str)`.
 */
export function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}
