'use client'

import { useCallback, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import type { CalendarBooking } from '../../../convex/bookings'
import { parseConvexError } from '@/lib/utils/convex-error'

interface UseBookingActionsReturn {
  detailBooking: CalendarBooking | null
  detailError: string | null
  setDetailBooking: (booking: CalendarBooking | null) => void
  handleBookingClick: (id: string, bookings: CalendarBooking[]) => void
  clearDetail: () => void

  isAccepting: boolean
  isDeclining: boolean
  handleDetailAccept: (bookingId: string) => Promise<void>
  handleDetailDecline: (bookingId: string) => Promise<void>

  urgentCancelId: string | null
  setUrgentCancelId: (id: string | null) => void
  handleUrgentCancel: (bookingId: string, isOperator: boolean) => void
}

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

  const handleDetailAction = useCallback(async (
    bookingId: string,
    setLoading: (loading: boolean) => void,
    optimisticStatus: CalendarBooking['reservationStatus'],
    mutation: typeof acceptByBooking,
    fallbackMessage: string,
  ) => {
    setLoading(true)
    setDetailError(null)

    const previousBooking = detailBooking
    if (detailBooking) {
      setDetailBooking({ ...detailBooking, reservationStatus: optimisticStatus })
    }

    try {
      await mutation({ bookingId: bookingId as Id<'bookings'> })
      setDetailBooking(null)
    } catch (err) {
      const message = parseConvexError(err, fallbackMessage)
      setDetailError(message)
      if (previousBooking) {
        setDetailBooking(previousBooking)
      }
    } finally {
      setLoading(false)
    }
  }, [detailBooking])

  const handleDetailAccept = useCallback(
    (bookingId: string) => handleDetailAction(
      bookingId,
      setIsAccepting,
      'Confirmed',
      acceptByBooking,
      'Failed to accept booking',
    ),
    [acceptByBooking, handleDetailAction],
  )

  const handleDetailDecline = useCallback(
    (bookingId: string) => handleDetailAction(
      bookingId,
      setIsDeclining,
      'Vacated',
      declineByBooking,
      'Failed to decline booking',
    ),
    [declineByBooking, handleDetailAction],
  )

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
