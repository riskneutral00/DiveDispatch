'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery } from 'convex/react'
import { mapPortalMutationError } from '@/lib/utils/convex-error'
import { CheckCircle, Circle, AlertTriangle, PartyPopper } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
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
  incompleteLabel: string
}

function StepRow({ label, complete, required, incompleteLabel }: StepRowProps) {
  if (!required) return null
  return (
    <div className="flex items-center gap-3">
      {complete ? (
        <CheckCircle
          size={18}
          className="text-success shrink-0"
          aria-hidden
        />
      ) : (
        <Circle className="text-secondary shrink-0"
          size={18}
          aria-hidden
        />
      )}
      <span
        className={`text-body ${complete ? 'text-primary' : 'text-secondary'}`}
      >
        {label}
      </span>
      {!complete && (
        <span
          className="ml-auto text-label text-warning"
        >
          {incompleteLabel}
        </span>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PortalSubmit({ token }: PortalSubmitProps) {
  const tPortal = useTranslations('portal')
  const tCommon = useTranslations('common')

  const status = useQuery(api.portalSubmission.getPortalStatus, { token })
  const submitPortal = useMutation(api.portalSubmission.submitPortal)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [medicalHardBlock, setMedicalHardBlock] = useState(false)

  if (status === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    )
  }

  if (status === null) {
    return (
      <Card padding="lg">
        <InlineError centered>{tPortal('tokenExpired')}</InlineError>
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
                className="w-12 h-12 text-warning"
                aria-hidden
              />
              <h2
                className="text-xl font-semibold text-primary font-heading"
              >
                Submitted
              </h2>
              <p className="text-body leading-relaxed text-secondary">
                {tPortal('medicalBlockMessage')}
              </p>
            </>
          ) : (
            <>
              <PartyPopper
                className="w-12 h-12 text-success"
                aria-hidden
              />
              <h2
                className="text-xl font-semibold text-primary font-heading"
              >
                Complete!
              </h2>
              <p className="text-body leading-relaxed text-secondary">
                {tPortal('successMessage')}
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
          className="text-base font-semibold mb-4 text-primary font-heading"
        >
          Review &amp; Submit
        </h2>
        <div className="flex flex-col gap-3">
          <StepRow
            label="Contact & Certification"
            complete={status.contactComplete}
            required={status.portalContact}
            incompleteLabel={tCommon('incomplete')}
          />
          <StepRow
            label="Medical Questionnaire"
            complete={status.medicalComplete}
            required={status.portalMedical}
            incompleteLabel={tCommon('incomplete')}
          />
          <StepRow
            label="Liability Waiver"
            complete={status.waiverComplete}
            required={status.portalWaiver}
            incompleteLabel={tCommon('incomplete')}
          />
        </div>
      </Card>

      {!allComplete && (
        <p className="text-body text-center text-secondary">
          {tPortal('formsIncomplete')}
        </p>
      )}

      {error && <InlineError centered>{error}</InlineError>}

      <Button
        variant="primary"
        fullWidth
        size="lg"
        disabled={!allComplete || submitting}
        loading={submitting}
        onClick={handleSubmit}
      >
        {tCommon('submit')}
      </Button>
    </div>
  )
}
