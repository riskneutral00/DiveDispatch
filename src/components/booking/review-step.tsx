'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from 'convex/react'
import { Calendar, Users, Send, ChevronLeft } from 'lucide-react'
import { ErrorAlert } from '@/components/ui/error-alert'
import { api } from '@/lib/convex-generated'
import { Card, Button } from '@/components/ui'
import { countryCodeToEmoji } from '@/components/ui/flag-emoji'
import { courseLabel } from '@/lib/constants/course-catalog'
import { deriveActivityType } from '@/lib/booking/wizard-state'
import type { WizardState, WizardAction } from '@/lib/booking/wizard-state'
import { formatDateRange } from '@/lib/booking/booking-display'
import { parseConvexError } from '@/lib/utils/convex-error'
import { validateReviewStep, buildSubmitPayload } from '@/lib/booking/build-submit-payload'
import type { Dispatch } from 'react'
import { FormSectionHeader } from '@/components/ui/form-section-header'

interface ReviewStepProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
  isEditMode?: boolean
}

export function ReviewStep({ state, dispatch, isEditMode = false }: ReviewStepProps) {
  const router = useRouter()
  const submitToDraft = useMutation(api.bookings.create.submitToDraft)

  const [submitError, setSubmitError] = useState<string | null>(null)

  const { customers, days, bookingId, startDate, endDate, submitting } = state

  const activityType = deriveActivityType(customers)

  async function handleSubmit() {
    if (!bookingId) return
    const err = validateReviewStep(state)
    if (err) { setSubmitError(err); return }
    setSubmitError(null)
    dispatch({ type: 'SET_SUBMITTING', value: true })

    try {
      const payload = buildSubmitPayload(state)
      await submitToDraft(payload)

      dispatch({ type: 'SET_SUBMITTED_BOOKING_ID', id: bookingId })
      router.push(isEditMode ? `/booking/${bookingId}` : '/dashboard')
    } catch (err) {
      dispatch({ type: 'SET_SUBMITTING', value: false })
      setSubmitError(parseConvexError(err, 'Submission failed. Try again.'))
    }
  }

  const validationError = validateReviewStep(state)

  return (
    <div className="flex flex-col gap-4">
      <Card padding="md">
        <FormSectionHeader label={
          <span className="flex items-center gap-1.5">
            <Users size={11} />
            Customers ({customers.length})
          </span>
        } />
        {customers.length === 0 ? (
          <p className="text-body text-secondary">
            No customers added.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {customers.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 text-body text-primary">
                {c.flags?.[0] ? (
                  <span className="text-base leading-none" /* design-ok: emoji size */>{countryCodeToEmoji(c.flags[0].code)}</span>
                ) : (
                  <span className="text-base leading-none" /* design-ok: emoji size */>🌐</span>
                )}
                <span className="font-medium">{c.name || `Customer ${i + 1}`}</span>
                {(c.courseEntries?.length ?? 0) > 0 && (
                  <span className="ml-auto text-label text-secondary">
                    {c.courseEntries?.map((e) => e.activityCode).filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padding="md">
        <FormSectionHeader label={
          <span className="flex items-center gap-1.5">
            <Calendar size={11} />
            Overview
          </span>
        } />
        <div className="text-body text-primary">
          <p>{formatDateRange(startDate, endDate)}</p>
          {activityType.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {activityType.map((code) => (
                <span
                  key={code}
                  className="px-2 py-0.5 rounded-full text-label font-medium text-accent"
                  style={{
                    background: 'var(--color-accent-muted)',
                    border: '1px solid var(--color-accent-border)',
                  }}
                >
                  {courseLabel(code)}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      {days.length > 0 && (
        <Card padding="md">
          <FormSectionHeader label={<>Schedule ({days.length} day{days.length !== 1 ? 's' : ''})</>} />
          <div className="flex flex-col gap-1.5">
            {days.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-body text-primary">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-label font-bold flex-shrink-0 glass-container"
                >
                  {i + 1}
                </span>
                <span>{d.date}</span>
                <span className="capitalize text-secondary">{d.venueType}</span>
                <span className="ml-auto text-label text-secondary">
                  {d.startTime}–{d.endTime}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {submitError && <ErrorAlert>{submitError}</ErrorAlert>}

      <div className="flex justify-between items-center gap-4 mt-2">
        <Button
          variant="secondary"
          size="md"
          disabled={submitting}
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'itinerary' })}
        >
          <ChevronLeft size={16} />
          Back
        </Button>
        <Button
          variant="primary"
          size="md"
          disabled={submitting || !bookingId || !!validationError}
          loading={submitting}
          onClick={() => void handleSubmit()}
        >
          <Send size={16} />
          {isEditMode ? 'Update' : 'Submit'}
        </Button>
      </div>

      {!submitting && validationError && (
        <p className="text-label text-center text-secondary">
          {validationError}
        </p>
      )}
    </div>
  )
}
