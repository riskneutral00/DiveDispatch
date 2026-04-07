import { BOOKING_STATUS } from './statuses'

export function isBookingExpired(booking: {
  status: string
  expiresAt?: number | null
}): boolean {
  return booking.status === BOOKING_STATUS.Draft && booking.expiresAt != null && booking.expiresAt < Date.now()
}
