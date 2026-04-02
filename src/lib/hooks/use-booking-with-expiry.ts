'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import type { BookingDetail } from '../../../convex/bookings'
import { isBookingExpired } from '../../../convex/shared/bookingExpiry'

/** Null-safe wrapper around the shared expiry predicate. */
function isExpiredBooking(
  booking: { status: string; expiresAt?: number | null } | null | undefined,
): boolean {
  if (!booking) return false
  return isBookingExpired(booking)
}

export type BookingWithExpiry = BookingDetail & { isExpired: boolean }

/**
 * Wraps getBookingDetail with lazy TTL expiry detection.
 *
 * On each render, checks whether the booking is a Draft past its holdTTL.
 * If so, fires checkAndExpireBooking once (authenticated, performs expiry
 * inline in the same mutation). Idempotent — no-op if already Cancelled.
 * Returns the booking augmented with a synthetic `isExpired` flag for UI use.
 *
 * This is the client side of "lazy expiry on read": Convex queries are
 * read-only, so expiry is split across query + authenticated mutation here.
 */
export function useBookingWithExpiry(bookingId: Id<'bookings'>): {
  booking: BookingWithExpiry | null | undefined
  isExpired: boolean
} {
  const booking = useQuery(api.bookings.getBookingDetail, { bookingId })
  const checkAndExpire = useMutation(api.bookings.status.checkAndExpireBooking)
  const hasTriggeredRef = useRef(false)

  useEffect(() => {
    if (!booking || hasTriggeredRef.current) return
    if (isExpiredBooking(booking)) {
      hasTriggeredRef.current = true
      checkAndExpire({ bookingId }).catch(() => {
        // Idempotent — safe to ignore; booking may already be Cancelled
      })
    }
  }, [booking, bookingId, checkAndExpire])

  const isExpired = isExpiredBooking(booking)

  return {
    booking: booking != null ? { ...booking, isExpired } : booking,
    isExpired,
  }
}
