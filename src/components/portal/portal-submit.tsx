'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { mapPortalMutationError } from '@/lib/utils/convex-error'
import { CheckCircle, Circle, AlertTriangle, PartyPopper } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import { TOKEN_EXPIRED_MESSAGE } from '@/lib/constants/error-messages'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

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
        <Circle className="text-secondary"
          size={18}
          style={{ flexShrink: 0 }}
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
      <Card padding="lg">
        <p className="text-center" style={{ color: 'var(--color-destructive)' }}>
          {TOKEN_EXPIRED_MESSAGE}
        </p>
      </Card>
    )
  }

  // Already submitted — show success page
  if (status.alreadySubmitted || submitted) {
    return (
      <Card padding="lg">
        <div className="flex flex-col items-center gap-4 text-center">
          {medicalHardBlock || status.medicalHardBlock ? (
            <>
              <AlertTriangle
                className="w-12 h-12"
                style={{ color: 'var(--color-warning)' }}
                aria-hidden
              />
              <h2
                className="text-xl font-semibold text-primary"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Submission Received
              </h2>
              <p className="text-sm leading-relaxed text-secondary">
                Your forms have been submitted. Your medical questionnaire requires physician clearance before diving. Your dive center has been notified and will be in touch.
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
                className="text-xl font-semibold text-primary"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                All Done!
              </h2>
              <p className="text-sm leading-relaxed text-secondary">
                Your paperwork is complete. Your dive center will confirm the details and reach out if needed. See you in the water!
              </p>
            </>
          )}
        </div>
      </Card>
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
      setError(mapPortalMutationError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card padding="md">
        <h2
          className="text-base font-semibold mb-4 text-primary"
          style={{ fontFamily: 'var(--font-heading)' }}
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
      </Card>

      {!allComplete && (
        <p className="text-sm text-center text-secondary">
          Please complete all steps above before submitting.
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

      <Button
        variant="primary"
        fullWidth
        size="lg"
        disabled={!allComplete || submitting}
        loading={submitting}
        onClick={handleSubmit}
      >
        Submit
      </Button>
    </div>
  )
}
