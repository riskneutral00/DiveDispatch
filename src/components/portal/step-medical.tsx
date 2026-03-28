'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { AlertTriangle } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'
import { medicalAnswersSchema } from '@/lib/validation'
import { getConvexErrorCode } from '@/lib/utils/convex-error'
import {
  TOKEN_EXPIRED_MESSAGE,
  BOOKING_CLOSED_MESSAGE,
  UNEXPECTED_ERROR_MESSAGE,
} from '@/lib/constants/error-messages'

// ── Questions ─────────────────────────────────────────────────────────────────

const MEDICAL_QUESTIONS = [
  {
    key: 'medical_q1',
    text: 'I have had problems with my lungs/breathing, heart, blood, or have been diagnosed with COVID-19.',
  },
  {
    key: 'medical_q2',
    text: 'I am over 45 years of age.',
  },
  {
    key: 'medical_q3',
    text: 'I struggle to perform moderate exercise (walk 1.6 km/one mile in 14 minutes) or swim 200 m/yards without resting.',
  },
  {
    key: 'medical_q4',
    text: 'I have had problems with my eyes, ears, or nasal passages/sinuses.',
  },
  {
    key: 'medical_q5',
    text: 'I have had surgery within the last 12 months, or ongoing problems related to past surgery.',
  },
  {
    key: 'medical_q6',
    text: 'I have lost consciousness, had migraine headaches, seizures, stroke, or significant head injury.',
  },
  {
    key: 'medical_q7',
    text: 'I am currently undergoing treatment for psychological problems, panic attacks, or addiction.',
  },
  {
    key: 'medical_q8',
    text: 'I have had back problems, hernia, ulcers, or diabetes.',
  },
  {
    key: 'medical_q9',
    text: 'I have had stomach or intestine problems, including recent diarrhea.',
  },
  {
    key: 'medical_q10',
    text: 'I am taking prescription medications (except birth control or anti-malarial drugs other than mefloquine).',
  },
] as const

type QuestionKey = (typeof MEDICAL_QUESTIONS)[number]['key']
type Answers = Partial<Record<QuestionKey, boolean>>

// ── Component ─────────────────────────────────────────────────────────────────

interface StepMedicalProps {
  token: string
  onComplete: () => void
}

export function StepMedical({ token, onComplete }: StepMedicalProps) {
  const saveMedicalAnswers = useMutation(api.customerProfiles.saveMedicalAnswers)
  const saved = useQuery(api.customerProfiles.getMedicalByToken, { token })

  const [answers, setAnswers] = useState<Answers>({})
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hardBlock, setHardBlock] = useState(false)

  // Pre-fill from saved state when returning to the portal; local answers take priority
  const effectiveAnswers: Answers =
    Object.keys(answers).length === 0 && saved?.answers
      ? (saved.answers as Answers)
      : answers

  const unanswered = MEDICAL_QUESTIONS.filter((q) => effectiveAnswers[q.key] === undefined)

  function setAnswer(key: QuestionKey, value: boolean) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)

    // Validate all 10 PADI medical questions are answered as booleans
    const answersForValidation = Object.fromEntries(
      MEDICAL_QUESTIONS.map((q) => [q.key, effectiveAnswers[q.key]]),
    )
    const schemaResult = medicalAnswersSchema.safeParse(answersForValidation)
    if (!schemaResult.success) return

    setSubmitting(true)
    setError(null)

    try {
      const answersRecord: Record<string, boolean | string> = {}
      for (const q of MEDICAL_QUESTIONS) {
        answersRecord[q.key] = effectiveAnswers[q.key] ?? false
      }

      const result = await saveMedicalAnswers({ token, answers: answersRecord })
      if (result.medicalHardBlock) {
        setHardBlock(true)
      } else {
        onComplete()
      }
    } catch (err) {
      const code = getConvexErrorCode(err)
      if (code === 'TOKEN_EXPIRED') {
        setError(TOKEN_EXPIRED_MESSAGE)
      } else if (code === 'BOOKING_CLOSED') {
        setError(BOOKING_CLOSED_MESSAGE)
      } else {
        setError(UNEXPECTED_ERROR_MESSAGE)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (hardBlock) {
    return (
      <GlassCard padding="lg">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle
            className="w-12 h-12"
            style={{ color: 'var(--color-warning)' }}
            aria-hidden="true"
          />
          <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Physician Clearance Required
          </h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            A medical condition requires physician clearance before diving. Your dive center has
            been notified and will contact you with next steps.
          </p>
          <GlassButton variant="primary" onClick={onComplete}>
            Continue
          </GlassButton>
        </div>
      </GlassCard>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Intro text — verbatim from PADI 10346 */}
      <GlassCard padding="md">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
          Recreational scuba diving and freediving requires good physical and mental health. There
          are a few medical conditions which can be hazardous while diving. This questionnaire
          provides a basis to determine if you should seek out a physician&apos;s evaluation.
          Answer all questions honestly.
        </p>
        <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <strong>Note to women:</strong> If you are pregnant, or attempting to become pregnant, do
          not dive.
        </p>
      </GlassCard>

      {/* 10 yes/no questions — all required */}
      <div className="flex flex-col gap-3">
        {MEDICAL_QUESTIONS.map((q, idx) => {
          const value = effectiveAnswers[q.key]
          const showError = touched && value === undefined

          return (
            <GlassCard key={q.key} padding="md">
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                  <span
                    className="font-semibold mr-1"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {idx + 1}.
                  </span>
                  {q.text}
                </p>

                <div className="flex gap-6" role="group" aria-label={`Question ${idx + 1}`}>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name={q.key}
                      value="yes"
                      checked={value === true}
                      onChange={() => setAnswer(q.key, true)}
                      className="w-4 h-4"
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      Yes
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name={q.key}
                      value="no"
                      checked={value === false}
                      onChange={() => setAnswer(q.key, false)}
                      className="w-4 h-4"
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      No
                    </span>
                  </label>
                </div>

                {showError && (
                  <p className="text-xs" style={{ color: 'var(--color-destructive)' }} role="alert">
                    This field is required.
                  </p>
                )}
              </div>
            </GlassCard>
          )
        })}
      </div>

      {/* Participant statement — verbatim */}
      <GlassCard padding="md">
        <p className="text-sm leading-relaxed italic" style={{ color: 'var(--color-text-secondary)' }}>
          &ldquo;I have answered all questions honestly, and understand that I accept responsibility
          for any consequences resulting from any questions I may have answered inaccurately or for
          my failure to disclose any existing or past health conditions.&rdquo;
        </p>
      </GlassCard>

      {touched && unanswered.length > 0 && !error && (
        <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }} role="alert">
          Please answer all {unanswered.length} remaining question{unanswered.length !== 1 ? 's' : ''}.
        </p>
      )}

      {error && (
        <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }} role="alert">
          {error}
        </p>
      )}

      <GlassButton type="submit" variant="primary" fullWidth loading={submitting} size="lg">
        Continue
      </GlassButton>
    </form>
  )
}
