/**
 * Canonical booking expiry predicate.
 * Pure function — no framework dependencies. Used by both server (convex/)
 * and client (src/lib/) to determine if a Draft booking's hold TTL has lapsed.
 */

/**
 * True when a Draft booking's hold TTL has lapsed.
 * Safe default: bookings without expiresAt never expire (treat as Upcoming-eligible).
 */
export function isBookingExpired(booking: {
  status: string
  expiresAt?: number | null
}): boolean {
  return booking.status === 'Draft' && booking.expiresAt != null && booking.expiresAt < Date.now()
}
