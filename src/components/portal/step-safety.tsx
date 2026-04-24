'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { CardTitle } from '@/components/ui/card-title'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_TEXTAREA_ROWS } from '@/lib/constants/form-config'
import { usePortalStep } from '@/lib/hooks/use-portal-step'
import { usePortalSafety } from '@/lib/hooks/use-portal-safety'
import { Spinner } from '@/components/ui/spinner'
import { PortalStepShell } from '@/components/portal/portal-step-shell'
import { FieldRow } from '@/components/ui/field-row'

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
  const t = useTranslations('portal')
  const tErrors = useTranslations('errors')
  const { saved, save: saveSafetyInfo } = usePortalSafety({ token })

  const [form, setForm] = useState<SafetyForm>(defaultForm())
  const {
    serverError,
    clearServerError,
    handleMutationError,
    submitting,
    setSubmitting,
  } = usePortalStep(tErrors)

  useEffect(() => {
    if (saved) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- comments-ok loads async-saved portal safety data into form on first arrival */
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
          <CardTitle className="mb-1">{t('sectionSafety')}</CardTitle>
          <p className="text-body text-secondary">
            {t('safetyDescription')}
          </p>
        </div>

        <FieldRow>
          <SimpleSelect
            label={t('bloodType')}
            className="field-sm"
            value={form.bloodType}
            onChange={(v) => setField('bloodType', v)}
            options={BLOOD_TYPES}
            placeholder={t('placeholderBloodType')}
          />

          <Textarea
            label={t('allergiesSafety')}
            value={form.allergies}
            onChange={(e) => setField('allergies', e.target.value)}
            placeholder={t('placeholderAllergiesSafety')}
            rows={DEFAULT_TEXTAREA_ROWS}
            maxLength={500}
          />

          <Textarea
            label={t('currentMedications')}
            value={form.medications}
            onChange={(e) => setField('medications', e.target.value)}
            placeholder={t('placeholderMedications')}
            rows={DEFAULT_TEXTAREA_ROWS}
            maxLength={500}
          />

          <Input
            label={t('insurancePolicyNumber')}
            type="text"
            placeholder={t('placeholderInsurance')}
            value={form.insurancePolicyNumber}
            onChange={(e) => setField('insurancePolicyNumber', e.target.value)}
            className="field-md"
          />
        </FieldRow>
      </Card>
    </PortalStepShell>
  )
}
