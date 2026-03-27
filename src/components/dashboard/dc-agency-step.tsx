'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassCard, GlassInput } from '@/components/glass'
import { LoadingCard } from '@/components/glass/loading-card'
import { DIVE_AGENCIES_EXTENDED } from '@/lib/constants/agencies'

type Association = { agencyCode: string; memberId: string }

interface DcAgencyStepProps {
  onSaved: () => void
  onBack: () => void
}

export function DcAgencyStep({ onSaved, onBack }: DcAgencyStepProps) {
  const existing = useQuery(api.diveCenters.mine)
  const update = useMutation(api.diveCenters.update)

  const [associations, setAssociations] = useState<Association[]>([{ agencyCode: '', memberId: '' }])
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
    setAssociations((prev) => [...prev, { agencyCode: '', memberId: '' }])
  }

  function removeRow(idx: number) {
    setAssociations((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))
  }

  function updateRow(idx: number, field: keyof Association, value: string) {
    setAssociations((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  const isComplete = associations.some((a) => a.agencyCode.trim() && a.memberId.trim())

  async function handleNext() {
    if (!isComplete) return
    const valid = associations.filter((a) => a.agencyCode.trim() && a.memberId.trim())
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
    return <LoadingCard />
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
          <div key={idx}>
            {idx > 0 && <hr className="form-divider mb-4" />}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Agency
                </label>
                <select
                  value={assoc.agencyCode}
                  onChange={(e) => updateRow(idx, 'agencyCode', e.target.value)}
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
                value={assoc.memberId}
                onChange={(e) => updateRow(idx, 'memberId', e.target.value)}
                placeholder="e.g. TH-0012345"
              />
            </div>
            {associations.length > 1 && (
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  aria-label="Remove affiliation"
                  className="flex items-center gap-1.5 text-xs cursor-pointer rounded px-2 py-1.5 transition-colors duration-150"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-destructive, var(--color-text-secondary))'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
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
