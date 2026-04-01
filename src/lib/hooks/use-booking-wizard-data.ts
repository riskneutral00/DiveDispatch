'use client'

import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { WizardState } from '@/lib/booking/wizard-state'
import { useBookingDraftAutoSave } from '@/lib/hooks/use-booking-draft-auto-save'
import { useCurrentUser } from '@/lib/hooks/use-current-user'

export function useBookingWizardData({
  state,
  isEditMode,
  initialBookingId,
}: {
  state: WizardState
  isEditMode: boolean
  initialBookingId?: string
}) {
  const createDraftShell = useMutation(
    api.bookingDraftMutations.createDraftShell,
  )
  const saveDraftState = useMutation(api.bookingDraftMutations.saveDraftState)
  const discardDraft = useMutation(api.bookingDraftMutations.discardDraft)
  const editBooking = useMutation(api.bookings.edit.editBooking)

  const { user: convexUserForPortal } = useCurrentUser()

  const existingBooking = useQuery(
    api.bookingDraftMutations.getBookingForWizard,
    isEditMode && initialBookingId
      ? { bookingId: initialBookingId as Id<'bookings'> }
      : 'skip',
  )

  const { autoSaveError, cancelPending } = useBookingDraftAutoSave(
    state.bookingId,
    state,
  )

  return {
    createDraftShell,
    saveDraftState,
    discardDraft,
    editBooking,
    convexUserForPortal,
    existingBooking,
    autoSaveError,
    cancelPending,
  }
}
