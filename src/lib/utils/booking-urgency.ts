const URGENT_THRESHOLD_MS = 12 * 60 * 60 * 1000 // 12 hours

/**
 * A Draft booking is urgent when its startDate is within 12 hours from now.
 * Returns false for non-Draft statuses.
 */
export function isUrgentDraft(booking: { status: string; startDate: string }): boolean {
  if (booking.status !== 'Draft') return false
  const [y, m, d] = booking.startDate.split('-').map(Number)
  const startMs = new Date(y, m - 1, d).getTime()
  return startMs - Date.now() < URGENT_THRESHOLD_MS
}

/**
 * Human-readable countdown for urgent drafts.
 * Returns null if the booking isn't urgent.
 */
export function urgentCountdown(booking: { status: string; startDate: string }): string | null {
  if (!isUrgentDraft(booking)) return null
  const [y, m, d] = booking.startDate.split('-').map(Number)
  const startMs = new Date(y, m - 1, d).getTime()
  const diffMs = startMs - Date.now()
  if (diffMs <= 0) return 'Started'
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours > 0) return `Starts in ${hours}h`
  const mins = Math.floor(diffMs / (1000 * 60))
  return `Starts in ${mins}m`
}
