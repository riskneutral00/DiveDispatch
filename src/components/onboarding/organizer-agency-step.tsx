'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import { Button, Input, SimpleSelect } from '@/components/ui'
import { LoadingCard } from '@/components/ui/loading-card'
import { DIVE_AGENCIES_EXTENDED } from '@/lib/constants/agencies'
import { parseConvexError } from '@/lib/utils/convex-error'
import type { ClerkRole } from '@/lib/constants/roles'
import { OrganizerStepCard } from './organizer-step-card'

type Association = { agency: string; number: string }

interface OrganizerAgencyStepProps {
  role: ClerkRole
  onSaved: () => void
  onBack: () => void
}

function useRoleApi(role: ClerkRole) {
  switch (role) {
    case 'DiveCenter':
      return { mine: api.diveCenters.mine, update: api.diveCenters.update } as const
    case 'Agent':
      return { mine: api.agents.mine, update: api.agents.update } as const
    default:
      return null
  }
}

export function OrganizerAgencyStep({ role, onSaved, onBack }: OrganizerAgencyStepProps) {
  const roleApi = useRoleApi(role)

  // Shouldn't happen — agency step is only in the config for DiveCenter/Agent
  if (!roleApi) {
    return (
      <OrganizerStepCard title="" subtitle="" onNext={onSaved} autoAdvance>
        <div />
      </OrganizerStepCard>
    )
  }

  return <AgencyStepInner roleApi={roleApi} onSaved={onSaved} onBack={onBack} />
}

interface AgencyStepInnerProps {
  roleApi: NonNullable<ReturnType<typeof useRoleApi>>
  onSaved: () => void
  onBack: () => void
}

function AgencyStepInner({ roleApi, onSaved, onBack }: AgencyStepInnerProps) {
  const existing = useQuery(roleApi.mine)
  const update = useMutation(roleApi.update)

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
    setAssociations((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))
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
      setError(parseConvexError(err, 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  if (existing === undefined) {
    return <LoadingCard />
  }

  return (
    <OrganizerStepCard
      title="Agency Affiliations"
      subtitle="Add your dive agency membership numbers."
      onBack={onBack}
      onNext={handleNext}
      loading={saving}
      disabled={!isComplete}
    >
      <div className="flex flex-col gap-4">
        {associations.map((assoc, idx) => (
          <div key={idx}>
            {idx > 0 && <hr className="form-divider mb-4" />}
            <div className="flex flex-wrap gap-3">
              <SimpleSelect
                label="Agency"
                value={assoc.agency}
                onChange={(v) => updateRow(idx, 'agency', v)}
                options={DIVE_AGENCIES_EXTENDED.map(a => a)}
                placeholder="Select agency..."
                className="field-select-short"
              />
              <Input
                label="Member Number"
                value={assoc.number}
                onChange={(e) => updateRow(idx, 'number', e.target.value)}
                className="field-text-short"
                placeholder="e.g. TH-0012345"
              />
            </div>
            {associations.length > 1 && (
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  aria-label="Remove affiliation"
                  className="flex items-center gap-1.5 text-xs cursor-pointer rounded px-2 py-1.5 transition-colors text-secondary"
                  style={{ transitionDuration: 'var(--transition-speed)' }}
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

        <Button type="button" variant="secondary" size="sm" onClick={addRow} className="self-start">
          <Plus size={14} />
          Add another
        </Button>

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{error}</p>
        )}
      </div>
    </OrganizerStepCard>
  )
}
