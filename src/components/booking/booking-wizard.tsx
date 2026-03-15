'use client'

import { useReducer, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from 'convex/react'
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { GlassCard, GlassButton } from '@/components/glass'
import { WizardProgress } from './wizard-progress'
import { CustomerStep } from './customer-step'
import { ItineraryStep } from './itinerary-step'
import { ReviewStep } from './review-step'
import { AddCustomerDialog } from './add-customer-dialog'
import {
  wizardReducer,
  makeInitialState,
  serializeDraftState,
  deserializeDraftState,
  WIZARD_STEPS,
  WIZARD_STEP_LABELS,
  type WizardStep,
  type CustomerData,
} from '@/lib/booking/wizard-state'
import { useBookingDraftAutoSave } from '@/hooks/useBookingDraftAutoSave'
import type { Language } from '@/lib/types/language'
import type { CustomerContact } from '@/lib/booking/wizard-state'
import { getSharedLanguages } from '@/lib/utils/language-matching'

// ── Component ─────────────────────────────────────────────────────────────────

interface BookingWizardProps {
  bookingId?: string
}

export function BookingWizard({ bookingId: initialBookingId }: BookingWizardProps) {
  const router = useRouter()
  const isEditMode = !!initialBookingId

  const [state, dispatch] = useReducer(
    wizardReducer,
    makeInitialState(initialBookingId ?? null),
  )

  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [editResetError, setEditResetError] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const creatingRef = useRef(false)
  const initializedRef = useRef(false)

  const createDraftShell = useMutation(api.bookingDraftMutations.createDraftShell)
  const saveDraftState = useMutation(api.bookingDraftMutations.saveDraftState)
  const editBooking = useMutation(api.bookings.edit.editBooking)

  const { autoSaveError, cancelPending } = useBookingDraftAutoSave(state.bookingId, state)

  const existingBooking = useQuery(
    api.bookingDraftMutations.getBookingForWizard,
    isEditMode && initialBookingId
      ? { bookingId: initialBookingId as Id<'bookings'> }
      : 'skip',
  )

  // Derived: show the confirm dialog when booking is Upcoming/Completed
  const showEditConfirm =
    isEditMode &&
    !isResetting &&
    existingBooking != null &&
    (existingBooking.status === 'Upcoming' || existingBooking.status === 'Completed')

  // Derived: show spinner until bookingId exists (new) or query resolves (edit)
  const isInitializing =
    !initError &&
    (isEditMode
      ? existingBooking === undefined || isResetting
      : state.bookingId === null)

  // New booking: create draft shell once on mount
  useEffect(() => {
    if (isEditMode || creatingRef.current || state.bookingId) return
    creatingRef.current = true

    createDraftShell()
      .then((id) => {
        dispatch({ type: 'SET_BOOKING_ID', payload: id })
      })
      .catch((err: unknown) => {
        creatingRef.current = false
        setInitError(err instanceof Error ? err.message : 'Failed to start booking')
      })
  }, [isEditMode, state.bookingId, createDraftShell])

  // Edit mode: redirect cancelled bookings + restore wizard state
  useEffect(() => {
    if (!isEditMode || existingBooking === undefined) return
    if (existingBooking === null) return

    if (existingBooking.status === 'Cancelled') {
      router.push(`/booking/${initialBookingId}`)
      return
    }

    if (existingBooking.status === 'Upcoming' || existingBooking.status === 'Completed') return

    if (initializedRef.current) return
    initializedRef.current = true

    if (existingBooking.draftState) {
      const restored = deserializeDraftState(existingBooking.draftState)
      if (restored) {
        dispatch({ type: 'RESET', payload: restored })
        return
      }
    }

    // Fallback: initialize with booking ID only
    dispatch({
      type: 'RESET',
      payload: {
        step: 'customers',
        bookingId: initialBookingId!,
      },
    })
  }, [isEditMode, existingBooking, initialBookingId, router])

  async function handleConfirmEdit() {
    if (!initialBookingId) return
    setEditResetError(null)
    setIsResetting(true)
    try {
      await editBooking({ bookingId: initialBookingId as Id<'bookings'> })
    } catch (err: unknown) {
      setEditResetError(err instanceof Error ? err.message : 'Failed to reset booking')
      setIsResetting(false)
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  const currentIndex = WIZARD_STEPS.indexOf(state.step)
  const isFirstStep = currentIndex === 0
  const isLastStep = currentIndex === WIZARD_STEPS.length - 1

  async function saveAndNavigate(targetStep: WizardStep) {
    setSaveError(null)
    cancelPending()

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

  // ── Customer add ────────────────────────────────────────────────────────────

  const sharedLanguages = getSharedLanguages(state.customers.map((c) => ({ flags: c.flags?.map((f) => ({ code: f.code, label: f.label })) ?? [] })))
  const commonLanguageCodes = sharedLanguages.map((l) => l.code)

  function handleAddCustomer(name: string, contact: CustomerContact, flags: Language[]) {
    const customer: CustomerData = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      name,
      contact,
      flags: flags.map((f) => ({ code: f.code, label: f.label })),
      courseEntries: [{ id: Math.random().toString(36).slice(2), activityCode: '', dates: [], agency: '' }],
    }
    dispatch({ type: 'ADD_CUSTOMER', customer })
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

  if (showEditConfirm) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <GlassCard padding="lg" elevated>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={20}
                className="flex-shrink-0 mt-0.5"
                style={{ color: 'var(--color-warning, #f59e0b)' }}
              />
              <div>
                <h2
                  className="text-lg font-semibold"
                  style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
                >
                  Edit this booking?
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
                  Editing will reset this booking to Draft and vacate all resource reservations.
                  All assigned resources will need to re-confirm.
                </p>
              </div>
            </div>
            {editResetError && (
              <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
                {editResetError}
              </p>
            )}
            <div className="flex gap-3">
              <GlassButton variant="primary" size="md" onClick={() => void handleConfirmEdit()}>
                Yes, edit booking
              </GlassButton>
              <GlassButton variant="secondary" size="md" onClick={() => router.back()}>
                Cancel
              </GlassButton>
            </div>
          </div>
        </GlassCard>
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

  const bookingRef = initialBookingId
    ? `#${initialBookingId.slice(-8).toUpperCase()}`
    : state.bookingId
      ? `#${state.bookingId.slice(-8).toUpperCase()}`
      : null

  // Review step renders its own layout (back + submit buttons inside)
  if (state.step === 'review') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            {isEditMode && bookingRef ? `Editing: ${bookingRef}` : 'New Booking'}
          </h1>
          {state.bookingId && (
            <p className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
              {state.bookingId}
            </p>
          )}
        </div>
        <WizardProgress currentStep={state.step} />
        <div className="mt-6">
          <GlassCard padding="lg" elevated>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
            >
              {WIZARD_STEP_LABELS[state.step]}
            </h2>
            <ReviewStep state={state} dispatch={dispatch} isEditMode={isEditMode} />
          </GlassCard>
        </div>
      </div>
    )
  }

  // Steps 1–2 with shared navigation
  function renderStepContent() {
    switch (state.step) {
      case 'customers':
        return (
          <CustomerStep
            customers={state.customers}
            dispatch={dispatch}
            onAddOpen={() => setAddDialogOpen(true)}
          />
        )
      case 'itinerary':
        return <ItineraryStep state={state} dispatch={dispatch} />
      default:
        return null
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          {isEditMode && bookingRef ? `Editing: ${bookingRef}` : 'New Booking'}
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
          className="text-lg font-semibold mb-4"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          {WIZARD_STEP_LABELS[state.step]}
        </h2>
        {renderStepContent()}
      </GlassCard>

      {/* Errors */}
      {saveError && (
        <p className="mt-3 text-sm" style={{ color: 'var(--color-destructive)' }}>
          {saveError}
        </p>
      )}
      {autoSaveError && !saveError && (
        <p className="mt-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {autoSaveError}
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
      </div>

      {/* Add customer dialog */}
      <AddCustomerDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddCustomer}
        commonLanguageCodes={commonLanguageCodes}
      />
    </div>
  )
}
