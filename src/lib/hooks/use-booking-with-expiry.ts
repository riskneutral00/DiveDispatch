'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import type { BookingDetail } from '../../../convex/bookings'
import { isBookingExpired } from '../../../convex/shared/bookingExpiry'

function isExpiredBooking(
  booking: { status: string; expiresAt?: number | null } | null | undefined,
): boolean {
  if (!booking) return false
  return isBookingExpired(booking)
}

export type BookingWithExpiry = BookingDetail & { isExpired: boolean }

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
      checkAndExpire({ bookingId }).catch((err) => {
        console.error('[useBookingWithExpiry] checkAndExpire failed:', err)
      })
    }
  }, [booking, bookingId, checkAndExpire])

  const isExpired = isExpiredBooking(booking)

  return {
    booking: booking != null ? { ...booking, isExpired } : booking,
    isExpired,
  }
}
