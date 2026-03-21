'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassInput } from '@/components/glass/glass-input'
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
            className="text-base font-semibold mb-1"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
          >
            Safety Information
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            All fields are optional. This information helps your dive operator respond in an
            emergency.
          </p>
        </div>

        <div className="space-y-5">
          {/* Blood type */}
          <div>
            <label
              className="text-sm font-medium block mb-1.5"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Blood Type{' '}
              <span className="font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                (Optional)
              </span>
            </label>
            <select
              value={bloodType}
              onChange={(e) => setBloodType(e.target.value)}
              className="glass w-full text-sm px-3 py-2.5 focus:outline-none focus:ring-2"
              style={{
                color: bloodType ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                caretColor: 'var(--color-accent)',
                borderRadius: 'var(--border-radius)',
                outlineColor: 'var(--color-accent)',
                appearance: 'none',
                backgroundImage: 'none',
              }}
            >
              <option value="">Select blood type</option>
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
          </div>

          {/* Allergies */}
          <div>
            <label
              className="text-sm font-medium block mb-1.5"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Allergies{' '}
              <span className="font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                (Optional)
              </span>
            </label>
            <textarea
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="e.g., penicillin, shellfish"
              rows={3}
              maxLength={500}
              className="glass w-full text-sm px-3 py-2.5 focus:outline-none focus:ring-2 resize-none"
              style={{
                color: 'var(--color-text-primary)',
                caretColor: 'var(--color-accent)',
                borderRadius: 'var(--border-radius)',
                outlineColor: 'var(--color-accent)',
              }}
            />
          </div>

          {/* Medications */}
          <div>
            <label
              className="text-sm font-medium block mb-1.5"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Current Medications{' '}
              <span className="font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                (Optional)
              </span>
            </label>
            <textarea
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              placeholder="e.g., aspirin, blood thinners"
              rows={3}
              maxLength={500}
              className="glass w-full text-sm px-3 py-2.5 focus:outline-none focus:ring-2 resize-none"
              style={{
                color: 'var(--color-text-primary)',
                caretColor: 'var(--color-accent)',
                borderRadius: 'var(--border-radius)',
                outlineColor: 'var(--color-accent)',
              }}
            />
          </div>

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
