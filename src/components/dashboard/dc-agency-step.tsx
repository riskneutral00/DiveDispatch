'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassCard, GlassInput } from '@/components/glass'
import { DIVE_AGENCIES_EXTENDED } from '@/lib/constants/agencies'

type Association = { agency: string; number: string }

interface DcAgencyStepProps {
  onSaved: () => void
  onBack: () => void
}

export function DcAgencyStep({ onSaved, onBack }: DcAgencyStepProps) {
  const existing = useQuery(api.diveCenters.mine)
  const update = useMutation(api.diveCenters.update)

  const [associations, setAssociations] = useState<Association[]>([{ agency: '', number: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (existing !== undefined && !initialized) {
      if (existing && existing.associations.length > 0) {
        setAssociations(existing.associations)
      }
      setInitialized(true)
    }
  }, [existing, initialized])

  function addRow() {
    setAssociations((prev) => [...prev, { agency: '', number: '' }])
  }

  function removeRow(idx: number) {
    setAssociations((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateRow(idx: number, field: keyof Association, value: string) {
    setAssociations((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  const isComplete = associations.some((a) => a.agency.trim() && a.number.trim())

  async function handleNext() {
    if (!isComplete) return
    const valid = associations.filter((a) => a.agency.trim() && a.number.trim())
    setSaving(true)
    setError(null)
    try {
      await update({ associations: valid })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (existing === undefined) {
    return (
      <GlassCard padding="lg">
        <div className="flex items-center justify-center py-8">
          <span className="text-sm animate-pulse" style={{ color: 'var(--color-text-secondary)' }}>
            Loading…
          </span>
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard padding="lg">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Agency Affiliations
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Add your dive agency membership numbers.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {associations.map((assoc, idx) => (
          <div key={idx} className="flex gap-2 items-end">
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Agency
                </label>
                <select
                  value={assoc.agency}
                  onChange={(e) => updateRow(idx, 'agency', e.target.value)}
                  className="glass w-full text-sm px-3 py-2.5 focus:outline-none"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <option value="">Select agency…</option>
                  {DIVE_AGENCIES_EXTENDED.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <GlassInput
                label="Member Number"
                value={assoc.number}
                onChange={(e) => updateRow(idx, 'number', e.target.value)}
                placeholder="e.g. TH-0012345"
              />
            </div>
            {associations.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="mb-0.5 flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 transition-colors"
                style={{ color: 'var(--color-destructive)' }}
                aria-label="Remove affiliation"
              >
                <Minus size={14} />
              </button>
            )}
          </div>
        ))}

        <GlassButton type="button" variant="secondary" size="sm" onClick={addRow} className="self-start">
          <Plus size={14} />
          Add another
        </GlassButton>

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{error}</p>
        )}

        <div className="flex gap-3 mt-2">
          <GlassButton variant="secondary" fullWidth onClick={onBack}>
            Back
          </GlassButton>
          <GlassButton
            variant="primary"
            fullWidth
            disabled={!isComplete || saving}
            loading={saving}
            onClick={handleNext}
          >
            Next
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  )
}
