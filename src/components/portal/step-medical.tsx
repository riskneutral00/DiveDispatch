'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { CardTitle } from '@/components/ui/card-title'
import { InlineError } from '@/components/ui/inline-error'
import { Button } from '@/components/ui/button'
import { medicalAnswersSchema } from '@/lib/validation'
import { usePortalStep } from '@/lib/hooks/use-portal-step'
import { usePortalMedical } from '@/lib/hooks/use-portal-medical'
import { PortalStepShell } from '@/components/portal/portal-step-shell'

const QUESTION_KEYS = [
  'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10',
] as const
type QuestionKey = `medical_${typeof QUESTION_KEYS[number]}`
type Answers = Partial<Record<QuestionKey, boolean>>

interface StepMedicalProps {
  token: string
  onComplete: () => void
}

export function StepMedical({ token, onComplete }: StepMedicalProps) {
  const t = useTranslations('medical')
  const tPortal = useTranslations('portal')
  const tCommon = useTranslations('common')
  const { saved, save: saveMedicalAnswers } = usePortalMedical({ token })

  const [answers, setAnswers] = useState<Answers>({})
  const [touched, setTouched] = useState(false)
  const [hardBlock, setHardBlock] = useState(false)
  const tErrors = useTranslations('errors')
  const {
    serverError: error,
    clearServerError,
    handleMutationError,
    submitting,
    setSubmitting,
  } = usePortalStep(tErrors)

  const effectiveAnswers: Answers =
    Object.keys(answers).length === 0 && saved?.answers
      ? (saved.answers as Answers)
      : answers

  const unanswered = QUESTION_KEYS.filter((qKey) => effectiveAnswers[`medical_${qKey}` as QuestionKey] === undefined)

  function setAnswer(key: QuestionKey, value: boolean) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)

    const answersForValidation = Object.fromEntries(
      QUESTION_KEYS.map((qKey) => {
        const key = `medical_${qKey}` as QuestionKey
        return [key, effectiveAnswers[key]]
      }),
    )
    const schemaResult = medicalAnswersSchema.safeParse(answersForValidation)
    if (!schemaResult.success) return

    setSubmitting(true)
    clearServerError()

    try {
      const answersRecord: Record<string, boolean | string> = {}
      for (const qKey of QUESTION_KEYS) {
        const key = `medical_${qKey}` as QuestionKey
        answersRecord[key] = effectiveAnswers[key] ?? false
      }

      const result = await saveMedicalAnswers({ token, answers: answersRecord })
      if (result.medicalHardBlock) {
        setHardBlock(true)
      } else {
        onComplete()
      }
    } catch (err) {
      handleMutationError(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (hardBlock) {
    return (
      <Card padding="lg">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle
            className="w-12 h-12 text-warning"
            aria-hidden="true"
          />
          <CardTitle>{tPortal('hardBlockTitle')}</CardTitle>
          <p className="text-secondary">
            {tPortal('hardBlockMessage')}
          </p>
          <Button variant="primary" onClick={onComplete}>
            {tCommon('continue')}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <PortalStepShell
      onSubmit={handleSubmit}
      continueType="submit"
      serverError={error}
      submitting={submitting}
      continueSize="lg"
      continueFullWidth
    >
      <Card padding="md">
        <p className="text-body leading-relaxed text-primary">
          {t('intro')}
        </p>
        <p className="mt-3 text-body text-secondary">
          {t('pregnancy')}
        </p>
      </Card>

      <Card padding="sm">
        <p className="text-label leading-relaxed text-secondary">
          {t('privacy')}{' '}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-primary"
          >
            {t('privacyLink')}
          </a>
        </p>
      </Card>

      <div className="flex flex-col gap-3">
        {QUESTION_KEYS.map((qKey, idx) => {
          const key = `medical_${qKey}` as QuestionKey
          const value = effectiveAnswers[key]
          const showError = touched && value === undefined

          return (
            <Card key={key} padding="md">
              <div className="flex flex-col gap-3">
                <p className="text-body leading-relaxed text-primary">
                  <span
                    className="font-semibold mr-1 text-secondary"
                  >
                    {idx + 1}.
                  </span>
                  {t(qKey)}
                </p>

                <div className="flex gap-6" role="group" aria-label={`Question ${idx + 1}`}>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input /* design-ok: native radio for medical yes/no */
                      type="radio"
                      name={key}
                      value="yes"
                      checked={value === true}
                      onChange={() => setAnswer(key, true)}
                      className="w-4 h-4"
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span className="text-body text-primary">
                      {tCommon('yes')}
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input /* design-ok: native radio for medical yes/no */
                      type="radio"
                      name={key}
                      value="no"
                      checked={value === false}
                      onChange={() => setAnswer(key, false)}
                      className="w-4 h-4"
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span className="text-body text-primary">
                      {tCommon('no')}
                    </span>
                  </label>
                </div>

                <div aria-live="polite">
                  {showError && (
                    <InlineError size="sm">Answer required.</InlineError>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Card padding="md">
        <p className="text-body leading-relaxed italic text-secondary">
          &ldquo;{t('statement')}&rdquo;
        </p>
      </Card>

      <div aria-live="polite">
        {touched && unanswered.length > 0 && !error && (
          <InlineError centered>
            {tPortal('answerAllRemaining', { count: unanswered.length })}
          </InlineError>
        )}
      </div>
    </PortalStepShell>
  )
}
