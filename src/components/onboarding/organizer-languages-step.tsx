'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { api } from '@/lib/convex-generated'
import { Input } from '@/components/ui'
import { LoadingCard } from '@/components/ui/loading-card'
import { resolveLanguages } from '@/lib/constants/dive-languages'
import { MAX_COURSE_DAYS } from '@/lib/constants/form-config'
import { LanguageField } from '@/components/profiles/language-field'
import { SpecialtyField } from '@/components/profiles/specialty-field'
import type { Language } from '@/lib/types/language'
import { parseConvexError } from '@/lib/utils/convex-error'
import type { ClerkRole } from '@/lib/constants/roles'
import { getOrganizerRoleFlags } from '@/lib/constants/organizer-wizard-config'
import { OrganizerStepCard } from './organizer-step-card'

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
    return (
      <OrganizerStepCard title="" subtitle="" onNext={onSaved} autoAdvance>
        <div />
      </OrganizerStepCard>
    )
  }

  return <LanguagesStepInner role={role} roleApi={roleApi} onSaved={onSaved} onBack={onBack} />
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

  const { supportsCoursePreferences } = getOrganizerRoleFlags(role)

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
      const lang = existing as { customerLanguages?: string[] } | null | undefined
      const langCodes: string[] = lang?.customerLanguages ?? me?.customerLanguages ?? []
      setFocusedLanguages(resolveLanguages(langCodes))
      if (supportsCoursePreferences) {
        const firstAssoc = existing?.associations?.[0] as {
          number: string; agency: string;
          owDays?: number; aowDays?: number; oaDays?: number; selectedSpecialties?: string[]
        } | undefined
        setOwDays(firstAssoc?.owDays?.toString() ?? '')
        setAowDays(firstAssoc?.aowDays?.toString() ?? '')
        setOaDays(firstAssoc?.oaDays?.toString() ?? '')
        setAowSpecialties(firstAssoc?.selectedSpecialties ?? [])
      }
      setInitialized(true)
    }
  }, [existing, me, initialized, supportsCoursePreferences])

  async function handleNext() {
    setSaving(true)
    setError(null)
    try {
      if (supportsCoursePreferences) {
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
    <OrganizerStepCard
      title="Languages & Preferences"
      subtitle={supportsCoursePreferences
        ? 'What languages do you teach in, and how long are your courses?'
        : 'What languages do your customers speak?'}
      onBack={onBack}
      onNext={handleNext}
      loading={saving}
    >
      <div className="flex flex-col gap-6">
        {supportsCoursePreferences ? (
          <div className="flex flex-wrap gap-4 w-full">
            <div className="flex flex-col gap-4 min-w-0">
              <LanguageField
                variant="customer"
                value={focusedLanguages}
                onChange={setFocusedLanguages}
              />
              <div>
                <p className="text-sm font-medium mb-1 text-secondary">
                  Default Course Durations <span style={{ fontWeight: 400 }}>(optional)</span>
                </p>
                <p className="text-xs mb-3 text-secondary">
                  Used when creating bookings.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="OW Days"
                    type="number"
                    min={1}
                    max={MAX_COURSE_DAYS}
                    value={owDays}
                    onChange={(e) => setOwDays(e.target.value)}
                    placeholder="4"
                  />
                  <Input
                    label="AOW Days"
                    type="number"
                    min={1}
                    max={MAX_COURSE_DAYS}
                    value={aowDays}
                    onChange={(e) => setAowDays(e.target.value)}
                    placeholder="2"
                  />
                  <Input
                    label="Adv. Days"
                    type="number"
                    min={1}
                    max={MAX_COURSE_DAYS}
                    value={oaDays}
                    onChange={(e) => setOaDays(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
            </div>
            <div className="min-w-0">
              <SpecialtyField
                agencyCode={firstAgency}
                value={aowSpecialties}
                onChange={setAowSpecialties}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 w-full">
            <LanguageField
              variant="customer"
              value={focusedLanguages}
              onChange={setFocusedLanguages}
            />
          </div>
        )}

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{error}</p>
        )}
      </div>
    </OrganizerStepCard>
  )
}
