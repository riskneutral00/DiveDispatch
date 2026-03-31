'use client'

import { useState, useEffect } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassButton } from '@/components/ui/glass-button'
import { GlassInput } from '@/components/ui/glass-input'
import { GlassSimpleSelect } from '@/components/ui/glass-simple-select'
import { GlassTextarea } from '@/components/ui/glass-textarea'
import { DEFAULT_TEXTAREA_ROWS } from '@/lib/constants/form-config'
import { usePortalStep } from '@/lib/hooks/use-portal-step'
import { usePortalSafety } from '@/lib/hooks/use-portal-safety'
import { Spinner } from '@/components/ui/spinner'

// ── Blood type options ────────────────────────────────────────────────────────

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

// ── Form state ────────────────────────────────────────────────────────────────

interface SafetyForm {
  bloodType: string
  allergies: string
  medications: string
  insurancePolicyNumber: string
}

const defaultForm = (): SafetyForm => ({
  bloodType: '',
  allergies: '',
  medications: '',
  insurancePolicyNumber: '',
})

// ── Component ─────────────────────────────────────────────────────────────────

interface StepSafetyProps {
  token: string
  onComplete: () => void
  onBack?: () => void
}

export function StepSafety({ token, onComplete, onBack }: StepSafetyProps) {
  const { saved, save: saveSafetyInfo } = usePortalSafety({ token })

  const [form, setForm] = useState<SafetyForm>(defaultForm())
  const {
    serverError,
    clearServerError,
    handleMutationError,
    submitting,
    setSubmitting,
  } = usePortalStep()

  // Pre-fill from saved data once loaded
  useEffect(() => {
    if (saved) {
      setForm({
        bloodType: saved.bloodType,
        allergies: saved.allergies,
        medications: saved.medications,
        insurancePolicyNumber: saved.insurancePolicyNumber,
      })
    }
  }, [saved])

  const setField = <K extends keyof SafetyForm>(key: K, value: SafetyForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    clearServerError()
  }

  async function handleContinue() {
    setSubmitting(true)
    clearServerError()
    try {
      await saveSafetyInfo({
        token,
        bloodType: form.bloodType,
        allergies: form.allergies,
        medications: form.medications,
        insurancePolicyNumber: form.insurancePolicyNumber,
      })
      onComplete()
    } catch (err) {
      handleMutationError(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (saved === undefined) {
    return (
      <div className="flex justify-center py-8" style={{ color: 'var(--color-primary)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <GlassCard padding="md">
        <div className="mb-5">
          <h2
            className="text-base font-semibold mb-1 text-primary"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Safety Information
          </h2>
          <p className="text-sm text-secondary">
            All fields are optional. This information helps your dive operator respond in an
            emergency.
          </p>
        </div>

        <div className="space-y-5">
          {/* Blood type */}
          <GlassSimpleSelect
            label="Blood Type (Optional)"
            value={form.bloodType}
            onChange={(v) => setField('bloodType', v)}
            options={BLOOD_TYPES}
            placeholder="Select blood type"
          />

          {/* Allergies */}
          <GlassTextarea
            label="Allergies (Optional)"
            value={form.allergies}
            onChange={(e) => setField('allergies', e.target.value)}
            placeholder="e.g., penicillin, shellfish"
            rows={DEFAULT_TEXTAREA_ROWS}
            maxLength={500}
          />

          {/* Medications */}
          <GlassTextarea
            label="Current Medications (Optional)"
            value={form.medications}
            onChange={(e) => setField('medications', e.target.value)}
            placeholder="e.g., aspirin, blood thinners"
            rows={DEFAULT_TEXTAREA_ROWS}
            maxLength={500}
          />

          {/* Insurance */}
          <GlassInput
            label="Travel Insurance Policy Number"
            type="text"
            placeholder="Policy number"
            value={form.insurancePolicyNumber}
            onChange={(e) => setField('insurancePolicyNumber', e.target.value)}
            helperText="Optional — enter your dive/travel insurance policy number."
          />
        </div>
      </GlassCard>

      {/* Server error */}
      <div aria-live="polite">
        {serverError && (
          <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }} role="alert">
            {serverError}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className={`flex ${onBack ? 'justify-between' : 'justify-end'}`}>
        {onBack && (
          <GlassButton type="button" variant="ghost" size="md" onClick={onBack}>
            Back
          </GlassButton>
        )}
        <GlassButton
          type="button"
          variant="primary"
          size="md"
          onClick={handleContinue}
          loading={submitting}
          disabled={submitting}
        >
          Continue
        </GlassButton>
      </div>
    </div>
  )
}
