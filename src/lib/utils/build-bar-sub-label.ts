import { shortenOperatorName } from './shorten-operator-name'
import type { CalendarBooking } from '../../../convex/bookings'

export function buildBarSubLabel(booking: CalendarBooking, viewerRole?: string): string | undefined {
  if (viewerRole === 'Instructor') {
    return shortenOperatorName(booking.operatorName)
  }
  const name = booking.instructorName
  if (!name) return undefined
  return name.split(' ')[0]
}
