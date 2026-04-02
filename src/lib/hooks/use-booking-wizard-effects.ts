'use client'

import { useEffect, type MutableRefObject } from 'react'
import { useRouter } from 'next/navigation'
import type { Dispatch } from 'react'
import {
  deserializeDraftState,
  type WizardAction,
  type BookingPreFill,
} from '@/lib/booking/wizard-state'
import type { Doc } from '@/lib/convex-generated'
export function useBookingWizardEffects({
  isEditMode,
  isOverlay,
  initialBookingId,
  initialCourses,
  initialPreFill,
  onComplete,
  state,
  dispatch,
  initializedRef,
  existingBooking,
}: {
  isEditMode: boolean
  isOverlay: boolean
  initialBookingId?: string
  initialCourses?: string[]
  initialPreFill?: BookingPreFill
  onComplete?: () => void
  state: { submittedBookingId: string | null }
  dispatch: Dispatch<WizardAction>
  initializedRef: MutableRefObject<boolean>
  existingBooking: Doc<'bookings'> | null | undefined
}) {
  const router = useRouter()

  useEffect(() => {
    if (isEditMode || initializedRef.current || !initialCourses?.length) return
    initializedRef.current = true
    const makeId = () =>
      Math.random().toString(36).slice(2) + Date.now().toString(36)
    dispatch({
      type: 'RESET',
      payload: {
        bookingId: null,
        customers: [
          {
            id: makeId(),
            name: '',
            contact: {},
            flags: [],
            courseEntries: initialCourses.map((code) => ({
              id: makeId(),
              activityCode: code,
              dates: [],
              agency: '',
            })),
          },
        ],
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, initialCourses])

  useEffect(() => {
    if (isEditMode || initializedRef.current || !initialPreFill) return
    initializedRef.current = true
    const makeId = () =>
      Math.random().toString(36).slice(2) + Date.now().toString(36)
    const {
      courses,
      startDate,
      endDate,
      agency,
      instructorSlug,
      venueSlug,
      boatSlug,
      equipmentSlug,
      compressorSlug,
    } = initialPreFill
    dispatch({
      type: 'RESET',
      payload: {
        bookingId: null,
        startDate,
        endDate,
        agency,
        equipment: equipmentSlug,
        compressor: compressorSlug,
        preFillInstructorSlug: instructorSlug || undefined,
        preFillVenueSlug: venueSlug || undefined,
        preFillBoatSlug: boatSlug || undefined,
        customers: [
          {
            id: makeId(),
            name: '',
            contact: {},
            flags: [],
            courseEntries:
              courses.length > 0
                ? courses.map((code) => ({
                    id: makeId(),
                    activityCode: code,
                    dates: [startDate, endDate],
                    agency,
                  }))
                : [
                    {
                      id: makeId(),
                      activityCode: '',
                      dates: [startDate, endDate],
                      agency,
                    },
                  ],
          },
        ],
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, initialPreFill])

  useEffect(() => {
    if (isOverlay && state.submittedBookingId && onComplete) {
      onComplete()
    }
  }, [isOverlay, state.submittedBookingId, onComplete])

  useEffect(() => {
    if (!isEditMode || existingBooking === undefined) return
    if (existingBooking === null) return

    if (existingBooking.status === 'Cancelled') {
      router.push(`/booking/${initialBookingId}`)
      return
    }

    if (
      existingBooking.status === 'Upcoming' ||
      existingBooking.status === 'Completed'
    )
      return

    if (initializedRef.current) return
    initializedRef.current = true

    if (existingBooking.draftState) {
      const restored = deserializeDraftState(existingBooking.draftState)
      if (restored) {
        dispatch({ type: 'RESET', payload: restored })
        return
      }
    }

    dispatch({
      type: 'RESET',
      payload: {
        step: 'customers',
        bookingId: initialBookingId!,
        ...(existingBooking.agentIsReferral
          ? { referralOwnerSlug: existingBooking.ownerId as string }
          : {}),
      },
    })
  }, [
    isEditMode,
    existingBooking,
    initialBookingId,
    router,
    dispatch,
    initializedRef,
  ])
}
