/**
 * Pure border color logic for booking bars.
 * Multi-day active bookings (Draft, Upcoming, Active, Urgent) get a distinct
 * multiday border. Completed and single-day bookings use their status border.
 */

import type { CalendarDisplayStatus } from '@/lib/constants/status-colors'

const MULTIDAY_BORDER_STATUSES = new Set<CalendarDisplayStatus>([
  'Active', 'Draft', 'Upcoming', 'Urgent',
])

export const MULTIDAY_BORDER_VAR = 'var(--color-status-multiday-border)'

export function getBarBorderColor(
  status: CalendarDisplayStatus,
  isMultiDay: boolean,
  statusBorderVar: string,
): string {
  if (isMultiDay && MULTIDAY_BORDER_STATUSES.has(status)) {
    return MULTIDAY_BORDER_VAR
  }
  return statusBorderVar
}
