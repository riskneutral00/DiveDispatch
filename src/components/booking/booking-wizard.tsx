'use client'

import { useReducer, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { GlassCard, GlassButton } from '@/components/glass'
import { WizardProgress } from './wizard-progress'
import {
  wizardReducer,
  makeInitialState,
  serializeDraftState,
  deserializeDraftState,
  WIZARD_STEPS,
  WIZARD_STEP_LABELS,
  type WizardStep,
} from '@/lib/booking/wizard-state'

// ── Step placeholder content ──────────────────────────────────────────────────

const STEP_DESCRIPTIONS: Record<WizardStep, string> = {
  details: 'Activity type, start/end dates, and portal settings — built in L1-22',
  divers: 'Add divers with name, nationality, and course selection — built in L1-23',
  resources: 'Assign instructor, boat, equipment, pool, and compressor — built in L1-24 + L1-25',
  review: 'Summary of all booking details and final submit — built in L1-26',
}

// ── Component ─────────────────────────────────────────────────────────────────

interface BookingWizardProps {
  bookingId?: string
}

export function BookingWizard({ bookingId: initialBookingId }: BookingWizardProps) {
  const isEditMode = !!initialBookingId

  const [state, dispatch] = useReducer(
    wizardReducer,
    makeInitialState(initialBookingId ?? null),
  )

  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  // initError only set on async failure (Promise .catch) — not setState in effect body
  const [initError, setInitError] = useState<string | null>(null)

  const creatingRef = useRef(false)
  const initializedRef = useRef(false)

  const createDraftShell = useMutation(api.bookingDraftMutations.createDraftShell)
  const saveDraftState = useMutation(api.bookingDraftMutations.saveDraftState)

  const existingBooking = useQuery(
    api.bookingDraftMutations.getBookingForWizard,
    isEditMode && initialBookingId
      ? { bookingId: initialBookingId as Id<'bookings'> }
      : 'skip',
  )

  // Derived: show spinner until bookingId exists (new) or query resolves (edit)
  const isInitializing =
    !initError && (isEditMode ? existingBooking === undefined : state.bookingId === null)

  // New booking: create draft shell once on mount
  useEffect(() => {
    if (isEditMode || creatingRef.current || state.bookingId) return
    creatingRef.current = true

    // Async — setState in .then/.catch is not flagged by react-hooks/set-state-in-effect
    createDraftShell()
      .then((id) => {
        dispatch({ type: 'SET_BOOKING_ID', payload: id })
      })
      .catch((err: unknown) => {
        creatingRef.current = false
        setInitError(err instanceof Error ? err.message : 'Failed to start booking')
      })
  }, [isEditMode, state.bookingId, createDraftShell])

  // Edit mode: restore state from existing booking once it loads
  useEffect(() => {
    if (!isEditMode || initializedRef.current || existingBooking === undefined) return
    initializedRef.current = true

    if (existingBooking === null) return

    if (existingBooking.draftState) {
      const restored = deserializeDraftState(existingBooking.draftState)
      if (restored) {
        dispatch({ type: 'RESET', payload: restored })
        return
      }
    }

    // Fallback: pre-fill details from booking fields
    dispatch({
      type: 'UPDATE_FIELD',
      payload: {
        activityType: existingBooking.activityType,
        startDate: existingBooking.startDate,
        endDate: existingBooking.endDate,
        portalContact: existingBooking.portalContact,
        portalMedical: existingBooking.portalMedical,
        portalWaiver: existingBooking.portalWaiver,
      },
    })
  }, [isEditMode, existingBooking])

  // ── Navigation ──────────────────────────────────────────────────────────────

  const currentIndex = WIZARD_STEPS.indexOf(state.step)
  const isFirstStep = currentIndex === 0
  const isLastStep = currentIndex === WIZARD_STEPS.length - 1

  async function saveAndNavigate(targetStep: WizardStep) {
    setSaveError(null)

    if (state.bookingId) {
      setIsSaving(true)
      try {
        await saveDraftState({
          bookingId: state.bookingId as Id<'bookings'>,
          draftState: serializeDraftState(state),
        })
      } catch (err: unknown) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save progress')
        setIsSaving(false)
        return
      }
      setIsSaving(false)
    }

    dispatch({ type: 'SET_STEP', payload: targetStep })
  }

  function handleBack() {
    if (isFirstStep) return
    void saveAndNavigate(WIZARD_STEPS[currentIndex - 1])
  }

  function handleNext() {
    if (isLastStep) return
    void saveAndNavigate(WIZARD_STEPS[currentIndex + 1])
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (initError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p style={{ color: 'var(--color-destructive)', fontFamily: 'var(--font-body)' }}>
          {initError}
        </p>
      </div>
    )
  }

  if (isInitializing) {
    return (
      <div
        className="max-w-3xl mx-auto px-4 py-16 flex items-center justify-center"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <span
          className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-3"
          aria-hidden
        />
        <span style={{ fontFamily: 'var(--font-body)' }}>Preparing booking…</span>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          {isEditMode ? 'Edit Booking' : 'New Booking'}
        </h1>
        {state.bookingId && (
          <p className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
            {state.bookingId}
          </p>
        )}
      </div>

      {/* Progress */}
      <WizardProgress currentStep={state.step} />

      {/* Step content */}
      <GlassCard className="mt-6" padding="lg" elevated>
        <h2
          className="text-lg font-semibold mb-2"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          {WIZARD_STEP_LABELS[state.step]}
        </h2>

        <div
          className="min-h-[240px] flex items-center justify-center rounded-lg border border-dashed"
          style={{ borderColor: 'var(--color-glass-border)' }}
        >
          <p
            className="text-sm text-center px-4"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            {STEP_DESCRIPTIONS[state.step]}
          </p>
        </div>
      </GlassCard>

      {/* Save error */}
      {saveError && (
        <p className="mt-3 text-sm" style={{ color: 'var(--color-destructive)' }}>
          {saveError}
        </p>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center mt-6 gap-4">
        <GlassButton
          variant="secondary"
          onClick={handleBack}
          disabled={isFirstStep || isSaving}
          size="md"
        >
          <ChevronLeft size={16} />
          Back
        </GlassButton>

        {isLastStep ? (
          <GlassButton variant="primary" disabled={!state.bookingId} size="md">
            <Send size={16} />
            Submit — L1-26
          </GlassButton>
        ) : (
          <GlassButton
            variant="primary"
            onClick={handleNext}
            disabled={isSaving}
            loading={isSaving}
            size="md"
          >
            Next
            <ChevronRight size={16} />
          </GlassButton>
        )}
      </div>
    </div>
  )
}
