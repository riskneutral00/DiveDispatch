'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassSimpleSelect } from '@/components/glass/glass-simple-select'
import { GlassTextarea } from '@/components/glass/glass-textarea'
import { DEFAULT_TEXTAREA_ROWS } from '@/lib/constants/form-config'
import { Spinner } from '@/components/common/spinner'

// ── Blood type options ────────────────────────────────────────────────────────

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

// ── Component ─────────────────────────────────────────────────────────────────

interface StepSafetyProps {
  token: string
  onComplete: () => void
  onBack?: () => void
}

export function StepSafety({ token, onComplete, onBack }: StepSafetyProps) {
  const saved = useQuery(api.customerProfiles.getSafetyInfoByToken, { token })
  const saveSafetyInfo = useMutation(api.customerProfiles.saveSafetyInfo)

  const [bloodType, setBloodType] = useState('')
  const [allergies, setAllergies] = useState('')
  const [medications, setMedications] = useState('')
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('')
  const [saving, setSaving] = useState(false)

  // Pre-fill from saved data once loaded
  useEffect(() => {
    if (saved) {
      setBloodType(saved.bloodType)
      setAllergies(saved.allergies)
      setMedications(saved.medications)
      setInsurancePolicyNumber(saved.insurancePolicyNumber)
    }
  }, [saved])

  async function handleContinue() {
    setSaving(true)
    try {
      await saveSafetyInfo({
        token,
        ...(bloodType ? { bloodType } : {}),
        ...(allergies ? { allergies } : {}),
        ...(medications ? { medications } : {}),
        ...(insurancePolicyNumber ? { insurancePolicyNumber } : {}),
      })
      onComplete()
    } finally {
      setSaving(false)
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
            value={bloodType}
            onChange={setBloodType}
            options={BLOOD_TYPES}
            placeholder="Select blood type"
          />

          {/* Allergies */}
          <GlassTextarea
            label="Allergies (Optional)"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="e.g., penicillin, shellfish"
            rows={DEFAULT_TEXTAREA_ROWS}
            maxLength={500}
          />

          {/* Medications */}
          <GlassTextarea
            label="Current Medications (Optional)"
            value={medications}
            onChange={(e) => setMedications(e.target.value)}
            placeholder="e.g., aspirin, blood thinners"
            rows={DEFAULT_TEXTAREA_ROWS}
            maxLength={500}
          />

          {/* Insurance */}
          <GlassInput
            label="Travel Insurance Policy Number"
            type="text"
            placeholder="Policy number"
            value={insurancePolicyNumber}
            onChange={(e) => setInsurancePolicyNumber(e.target.value)}
            helperText="Optional — enter your dive/travel insurance policy number."
          />
        </div>
      </GlassCard>

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
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Continue'}
        </GlassButton>
      </div>
    </div>
  )
}
