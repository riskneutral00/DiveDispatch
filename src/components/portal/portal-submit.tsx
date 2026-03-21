'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { CheckCircle, Circle, AlertTriangle, PartyPopper } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'
import { Spinner } from '@/components/common/spinner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortalSubmitProps {
  token: string
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StepRowProps {
  label: string
  complete: boolean
  required: boolean
}

function StepRow({ label, complete, required }: StepRowProps) {
  if (!required) return null
  return (
    <div className="flex items-center gap-3">
      {complete ? (
        <CheckCircle
          size={18}
          style={{ color: 'var(--color-success)', flexShrink: 0 }}
          aria-hidden
        />
      ) : (
        <Circle
          size={18}
          style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}
          aria-hidden
        />
      )}
      <span
        className="text-sm"
        style={{ color: complete ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
      {!complete && (
        <span
          className="ml-auto text-xs"
          style={{ color: 'var(--color-warning)' }}
        >
          Incomplete
        </span>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PortalSubmit({ token }: PortalSubmitProps) {
  const status = useQuery(api.portalSubmission.getPortalStatus, { token })
  const submitPortal = useMutation(api.portalSubmission.submitPortal)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [medicalHardBlock, setMedicalHardBlock] = useState(false)

  if (status === undefined) {
    return (
      <div className="flex items-center justify-center py-8" style={{ color: 'var(--color-primary)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (status === null) {
    return (
      <GlassCard padding="lg">
        <p className="text-center" style={{ color: 'var(--color-destructive)' }}>
          This link has expired or is invalid. Please contact your dive center for a new link.
        </p>
      </GlassCard>
    )
  }

  // Already submitted — show success page
  if (status.alreadySubmitted || submitted) {
    return (
      <GlassCard padding="lg">
        <div className="flex flex-col items-center gap-4 text-center">
          {medicalHardBlock || status.medicalHardBlock ? (
            <>
              <AlertTriangle
                className="w-12 h-12"
                style={{ color: 'var(--color-warning)' }}
                aria-hidden
              />
              <h2
                className="text-xl font-semibold"
                style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
              >
                Submission Received
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                Your forms have been submitted. However, your medical questionnaire
                indicates that physician clearance is required before diving. Your dive
                center has been notified and will contact you with next steps.
              </p>
            </>
          ) : (
            <>
              <PartyPopper
                className="w-12 h-12"
                style={{ color: 'var(--color-success)' }}
                aria-hidden
              />
              <h2
                className="text-xl font-semibold"
                style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
              >
                Submission Complete
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                Your booking paperwork is complete. Your dive center will confirm the
                final details and reach out with any questions. See you in the water!
              </p>
            </>
          )}
        </div>
      </GlassCard>
    )
  }

  const allComplete =
    (!status.portalContact || status.contactComplete) &&
    (!status.portalMedical || status.medicalComplete) &&
    (!status.portalWaiver || status.waiverComplete)

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      const result = await submitPortal({ token })
      setMedicalHardBlock(result.medicalHardBlock)
      setSubmitted(true)
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { code?: string; reason?: string }
        if (data.code === 'TOKEN_EXPIRED') {
          setError('This link has expired. Please contact your dive center for a new link.')
        } else if (data.code === 'BOOKING_CLOSED') {
          setError('This booking is no longer accepting submissions.')
        } else if (data.code === 'FORMS_INCOMPLETE') {
          setError(
            data.reason
              ? `Incomplete: ${data.reason}`
              : 'Please complete all required steps before submitting.',
          )
        } else {
          setError(data.reason ?? data.code ?? 'An error occurred. Please try again.')
        }
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <GlassCard padding="md">
        <h2
          className="text-base font-semibold mb-4"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
        >
          Review &amp; Submit
        </h2>
        <div className="flex flex-col gap-3">
          <StepRow
            label="Contact &amp; Certification"
            complete={status.contactComplete}
            required={status.portalContact}
          />
          <StepRow
            label="Medical Questionnaire"
            complete={status.medicalComplete}
            required={status.portalMedical}
          />
          <StepRow
            label="Liability Waiver"
            complete={status.waiverComplete}
            required={status.portalWaiver}
          />
        </div>
      </GlassCard>

      {!allComplete && (
        <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
          Complete all required steps above before submitting.
        </p>
      )}

      {error && (
        <p
          className="text-sm text-center"
          style={{ color: 'var(--color-destructive)' }}
          role="alert"
        >
          {error}
        </p>
      )}

      <GlassButton
        variant="primary"
        fullWidth
        size="lg"
        disabled={!allComplete || submitting}
        loading={submitting}
        onClick={handleSubmit}
      >
        Submit My Forms
      </GlassButton>
    </div>
  )
}
