'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_TEXTAREA_ROWS } from '@/lib/constants/form-config'
import { usePortalStep } from '@/lib/hooks/use-portal-step'
import { usePortalSafety } from '@/lib/hooks/use-portal-safety'
import { Spinner } from '@/components/ui/spinner'
import { PortalStepShell } from '@/components/portal/portal-step-shell'

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

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
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    )
  }

  return (
    <PortalStepShell
      serverError={serverError}
      onBack={onBack}
      onContinue={handleContinue}
      submitting={submitting}
    >
      <Card padding="md">
        <div className="mb-5">
          <h2
            className="text-card-title font-semibold mb-1 text-primary font-heading"
          >
            Safety Information
          </h2>
          <p className="text-body text-secondary">
            All optional. Helps your dive center respond in emergencies.
          </p>
        </div>

        <div className="space-y-5">
          <SimpleSelect
            label="Blood Type"
            value={form.bloodType}
            onChange={(v) => setField('bloodType', v)}
            options={BLOOD_TYPES}
            placeholder="Select blood type"
          />

          <Textarea
            label="Allergies"
            value={form.allergies}
            onChange={(e) => setField('allergies', e.target.value)}
            placeholder="Penicillin, shellfish"
            rows={DEFAULT_TEXTAREA_ROWS}
            maxLength={500}
          />

          <Textarea
            label="Current Medications"
            value={form.medications}
            onChange={(e) => setField('medications', e.target.value)}
            placeholder="Aspirin, blood thinners"
            rows={DEFAULT_TEXTAREA_ROWS}
            maxLength={500}
          />

          <Input
            label="Insurance Policy Number"
            type="text"
            placeholder="DAN-123456"
            value={form.insurancePolicyNumber}
            onChange={(e) => setField('insurancePolicyNumber', e.target.value)}
          />
        </div>
      </Card>
    </PortalStepShell>
  )
}
