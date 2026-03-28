'use client'

import { useCallback, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { CalendarBooking } from '../../../convex/bookings'
import { parseConvexError } from '@/lib/utils/convex-error'

// ── Types ────────────────────────────────────────────────────────────────────

interface UseBookingActionsReturn {
  // Detail dialog
  detailBooking: CalendarBooking | null
  detailError: string | null
  setDetailBooking: (booking: CalendarBooking | null) => void
  handleBookingClick: (id: string, bookings: CalendarBooking[]) => void
  clearDetail: () => void

  // Accept / decline (resource role)
  isAccepting: boolean
  isDeclining: boolean
  handleDetailAccept: (bookingId: string) => Promise<void>
  handleDetailDecline: (bookingId: string) => Promise<void>

  // Urgent cancel (operator role)
  urgentCancelId: string | null
  setUrgentCancelId: (id: string | null) => void
  handleUrgentCancel: (bookingId: string, isOperator: boolean) => void
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBookingActions(): UseBookingActionsReturn {
  const [detailBooking, setDetailBooking] = useState<CalendarBooking | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)
  const [urgentCancelId, setUrgentCancelId] = useState<string | null>(null)

  const acceptByBooking = useMutation(api.reservationsMutations.acceptByBookingForCaller)
  const declineByBooking = useMutation(api.reservationsMutations.declineByBookingForCaller)

  const handleBookingClick = useCallback(
    (id: string, bookings: CalendarBooking[]) => {
      const booking = bookings.find((b) => b._id === id)
      if (booking) setDetailBooking(booking)
    },
    [],
  )

  const clearDetail = useCallback(() => {
    setDetailBooking(null)
    setDetailError(null)
  }, [])

  const handleDetailAccept = useCallback(async (bookingId: string) => {
    setIsAccepting(true)
    setDetailError(null)
    try {
      await acceptByBooking({ bookingId: bookingId as Id<'bookings'> })
      setDetailBooking(null)
    } catch (err) {
      const message = parseConvexError(err, 'Failed to accept booking')
      setDetailError(message)
    } finally {
      setIsAccepting(false)
    }
  }, [acceptByBooking])

  const handleDetailDecline = useCallback(async (bookingId: string) => {
    setIsDeclining(true)
    setDetailError(null)
    try {
      await declineByBooking({ bookingId: bookingId as Id<'bookings'> })
      setDetailBooking(null)
    } catch (err) {
      const message = parseConvexError(err, 'Failed to decline booking')
      setDetailError(message)
    } finally {
      setIsDeclining(false)
    }
  }, [declineByBooking])

  const handleUrgentCancel = useCallback((bookingId: string, isOperator: boolean) => {
    if (isOperator) {
      setUrgentCancelId(bookingId)
    } else {
      handleDetailDecline(bookingId)
    }
  }, [handleDetailDecline])

  return {
    detailBooking,
    detailError,
    setDetailBooking,
    handleBookingClick,
    clearDetail,
    isAccepting,
    isDeclining,
    handleDetailAccept,
    handleDetailDecline,
    urgentCancelId,
    setUrgentCancelId,
    handleUrgentCancel,
  }
}
