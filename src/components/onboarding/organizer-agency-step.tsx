'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Input, InlineError, SimpleSelect } from '@/components/ui'
import { LoadingCard } from '@/components/ui/loading-card'
import { SectionDivider } from '@/components/ui/section-divider'
import { DIVE_AGENCIES_EXTENDED } from '@/lib/constants/agencies'
import { parseConvexError } from '@/lib/utils/convex-error'
import type { ClerkRole } from '@/lib/constants/roles'
import { useOrganizerRoleApi } from '@/lib/hooks/use-organizer-role-api'
import { OrganizerStepCard } from './organizer-step-card'

type Association = { agency: string; number: string }

interface OrganizerAgencyStepProps {
  role: ClerkRole
  onSaved: () => void
  onBack: () => void
}

export function OrganizerAgencyStep({ role, onSaved, onBack }: OrganizerAgencyStepProps) {
  const roleApi = useOrganizerRoleApi(role)

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
  roleApi: NonNullable<ReturnType<typeof useOrganizerRoleApi>>
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
      if (existing && 'associations' in existing && existing.associations.length > 0) {
        /* eslint-disable-next-line react-hooks/set-state-in-effect -- comments-ok one-shot init from async-loaded role record, guarded by initialized flag */
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
            <SectionDivider show={idx > 0} className="mb-4" />
            <div className="flex flex-wrap gap-3">
              <SimpleSelect
                label="Agency"
                value={assoc.agency}
                onChange={(v) => updateRow(idx, 'agency', v)}
                options={DIVE_AGENCIES_EXTENDED.map(a => a)}
                className="field-sm"
              />
              <Input
                label="Member Number"
                value={assoc.number}
                onChange={(e) => updateRow(idx, 'number', e.target.value)}
                className="field-md"
              />
            </div>
            {associations.length > 1 && (
              <div className="flex justify-end mt-2">
                <Button
                  type="button"
                  variant="destructive-ghost"
                  size="sm"
                  onClick={() => removeRow(idx)}
                  aria-label="Remove affiliation"
                >
                  <Trash2 size={14} />
                  Remove
                </Button>
              </div>
            )}
          </div>
        ))}

        <Button type="button" variant="secondary" size="sm" onClick={addRow} className="self-start">
          <Plus size={14} />
          Add another
        </Button>

        {error && <InlineError>{error}</InlineError>}
      </div>
    </OrganizerStepCard>
  )
}
