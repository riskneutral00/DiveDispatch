'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassCard, GlassInput } from '@/components/glass'
import { LoadingCard } from '@/components/glass/loading-card'
import { resolveLanguages } from '@/lib/constants/dive-languages'
import { MAX_COURSE_DAYS } from '@/lib/constants/form-config'
import { LanguageField } from '@/components/common/language-field'
import { SpecialtyField } from '@/components/common/specialty-field'
import type { Language } from '@/lib/types/language'
import { parseConvexError } from '@/lib/utils/convex-error'
import type { ClerkRole } from '@/lib/constants/roles'

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

interface OrganizerLanguagesStepProps {
  role: ClerkRole
  onSaved: () => void
  onBack: () => void
}

export function OrganizerLanguagesStep({ role, onSaved, onBack }: OrganizerLanguagesStepProps) {
  const roleApi = useRoleApi(role)

  // Roles without a languages step shouldn't reach here (config guards this),
  // but if they do, skip forward on next tick
  if (!roleApi) {
    return <LanguagesStepSkip onSaved={onSaved} />
  }

  return <LanguagesStepInner role={role} roleApi={roleApi} onSaved={onSaved} onBack={onBack} />
}

function LanguagesStepSkip({ onSaved }: { onSaved: () => void }) {
  useEffect(() => { onSaved() }, [onSaved])
  return null
}

interface LanguagesStepInnerProps {
  role: ClerkRole
  roleApi: NonNullable<ReturnType<typeof useRoleApi>>
  onSaved: () => void
  onBack: () => void
}

function LanguagesStepInner({ role, roleApi, onSaved, onBack }: LanguagesStepInnerProps) {
  const existing = useQuery(roleApi.mine)
  const me = useQuery(api.users.me)
  const update = useMutation(roleApi.update)

  const isDiveCenter = role === 'DiveCenter'

  const [focusedLanguages, setFocusedLanguages] = useState<Language[]>([])
  const [owDays, setOwDays] = useState('')
  const [aowDays, setAowDays] = useState('')
  const [oaDays, setOaDays] = useState('')
  const [aowSpecialties, setAowSpecialties] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (existing !== undefined && me !== undefined && !initialized) {
      const langCodes: string[] = (existing?.customerLanguages as string[]) ?? me?.customerLanguages ?? []
      setFocusedLanguages(resolveLanguages(langCodes))
      if (isDiveCenter) {
        const firstAssoc = existing?.associations?.[0]
        setOwDays(firstAssoc?.owDays?.toString() ?? '')
        setAowDays(firstAssoc?.aowDays?.toString() ?? '')
        setOaDays(firstAssoc?.oaDays?.toString() ?? '')
        setAowSpecialties(firstAssoc?.selectedSpecialties ?? [])
      }
      setInitialized(true)
    }
  }, [existing, me, initialized, isDiveCenter])

  async function handleNext() {
    setSaving(true)
    setError(null)
    try {
      if (isDiveCenter) {
        const owDaysNum = owDays ? parseInt(owDays, 10) : undefined
        const aowDaysNum = aowDays ? parseInt(aowDays, 10) : undefined
        const oaDaysNum = oaDays ? parseInt(oaDays, 10) : undefined
        const specialties = aowSpecialties.length > 0 ? aowSpecialties : undefined

        // Patch the first association with updated preferences
        const currentAssocs = existing?.associations ?? []
        const firstAssoc = currentAssocs[0] ?? { agency: 'PADI', number: '' }
        const patchedFirst = {
          ...firstAssoc,
          ...(owDaysNum !== undefined ? { owDays: owDaysNum } : {}),
          ...(aowDaysNum !== undefined ? { aowDays: aowDaysNum } : {}),
          ...(oaDaysNum !== undefined ? { oaDays: oaDaysNum } : {}),
          ...(specialties !== undefined ? { selectedSpecialties: specialties } : {}),
        }
        await update({
          associations: [patchedFirst, ...currentAssocs.slice(1)],
          customerLanguages: focusedLanguages.map((l) => l.code),
        })
      } else {
        await update({
          customerLanguages: focusedLanguages.map((l) => l.code),
        })
      }
      onSaved()
    } catch (err) {
      setError(parseConvexError(err, 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  if (existing === undefined || me === undefined) {
    return <LoadingCard />
  }

  const firstAgency = existing?.associations?.[0]?.agency ?? 'PADI'

  return (
    <GlassCard padding="lg">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1 text-primary">
          Languages & Preferences
        </h2>
        <p className="text-sm text-secondary">
          {isDiveCenter
            ? 'What languages do you teach in, and how long are your courses?'
            : 'What languages do your customers speak?'}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <LanguageField
            variant="customer"
            value={focusedLanguages}
            onChange={setFocusedLanguages}
          />
        </div>

        {isDiveCenter && (
          <>
            <div>
              <p className="text-sm font-medium mb-1 text-secondary">
                Default Course Durations <span style={{ fontWeight: 400 }}>(optional)</span>
              </p>
              <p className="text-xs mb-3 text-secondary">
                Used when creating bookings.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <GlassInput
                  label="Open Water Days"
                  type="number"
                  min={1}
                  max={MAX_COURSE_DAYS}
                  value={owDays}
                  onChange={(e) => setOwDays(e.target.value)}
                  placeholder="4"
                />
                <GlassInput
                  label="Advanced OW Days"
                  type="number"
                  min={1}
                  max={MAX_COURSE_DAYS}
                  value={aowDays}
                  onChange={(e) => setAowDays(e.target.value)}
                  placeholder="2"
                />
                <GlassInput
                  label="Adventure Days"
                  type="number"
                  min={1}
                  max={MAX_COURSE_DAYS}
                  value={oaDays}
                  onChange={(e) => setOaDays(e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>

            <SpecialtyField
              agencyCode={firstAgency}
              value={aowSpecialties}
              onChange={setAowSpecialties}
            />
          </>
        )}

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{error}</p>
        )}

        <div className="flex gap-3">
          <GlassButton variant="secondary" fullWidth onClick={onBack}>
            Back
          </GlassButton>
          <GlassButton
            variant="primary"
            fullWidth
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
