export function formatDateRange(start: string, end: string): string {
  if (!start && !end) return '\u2013' // en-dash
  if (start === end || !end) return start
  return `${start} \u2013 ${end}`
}

export type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'default'

export function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'Draft':
      return 'warning'
    case 'Upcoming':
      return 'info'
    case 'Completed':
      return 'success'
    case 'Cancelled':
      return 'destructive'
    default:
      return 'default'
  }
}

export function reservationVariant(
  status: string | undefined,
): 'success' | 'warning' | 'destructive' | 'default' {
  switch (status) {
    case 'Confirmed':
      return 'success'
    case 'PendingAcceptance':
      return 'warning'
    case 'Vacated':
    case 'NoShow':
      return 'destructive'
    default:
      return 'default'
  }
}

export function computeTTLLabel(expiresAt: number | undefined): string | null {
  if (!expiresAt) return null
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return 'Expired'
  const hours = Math.floor(remaining / (1000 * 60 * 60))
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${minutes}m remaining`
  return `${minutes}m remaining`
}
