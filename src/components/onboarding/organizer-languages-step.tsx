'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { api } from '@/lib/convex-generated'
import { InlineError, NumberPicker } from '@/components/ui'
import { LoadingCard } from '@/components/ui/loading-card'
import { resolveLanguages } from '@/lib/constants/dive-languages'
import { MAX_COURSE_DAYS } from '@/lib/constants/form-config'
import { LanguageField } from '@/components/ui/language-field'
import { SpecialtyField } from '@/components/profiles/specialty-field'
import type { Language } from '@/lib/types/language'
import { parseConvexError } from '@/lib/utils/convex-error'
import type { ClerkRole } from '@/lib/constants/roles'
import { useOrganizerRoleApi } from '@/lib/hooks/use-organizer-role-api'
import { getOrganizerRoleFlags } from '@/lib/constants/organizer-wizard-config'
import { OrganizerStepCard } from './organizer-step-card'

interface OrganizerLanguagesStepProps {
  role: ClerkRole
  onSaved: () => void
  onBack: () => void
}

export function OrganizerLanguagesStep({ role, onSaved, onBack }: OrganizerLanguagesStepProps) {
  const roleApi = useOrganizerRoleApi(role)

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
  roleApi: NonNullable<ReturnType<typeof useOrganizerRoleApi>>
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
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- comments-ok one-shot init from async-loaded role record */
      setFocusedLanguages(resolveLanguages(langCodes))
      if (supportsCoursePreferences) {
        const assocs = existing && 'associations' in existing ? existing.associations : []
        const firstAssoc = assocs?.[0] as {
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

        const currentAssocs = existing && 'associations' in existing ? existing.associations : []
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

  const firstAgency = existing && 'associations' in existing ? existing.associations?.[0]?.agency ?? 'PADI' : 'PADI'

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
                <p className="text-body font-medium mb-1 text-secondary">
                  Default Course Durations <span className="font-normal">(optional)</span>
                </p>
                <p className="text-label mb-3 text-secondary">
                  Used when creating bookings.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <NumberPicker
                    label="OW Days"
                    min={1}
                    max={MAX_COURSE_DAYS}
                    value={owDays === '' ? undefined : Number(owDays)}
                    onChange={(v) => setOwDays(v === undefined ? '' : String(v))}
                  />
                  <NumberPicker
                    label="AOW Days"
                    min={1}
                    max={MAX_COURSE_DAYS}
                    value={aowDays === '' ? undefined : Number(aowDays)}
                    onChange={(v) => setAowDays(v === undefined ? '' : String(v))}
                  />
                  <NumberPicker
                    label="Adv. Days"
                    min={1}
                    max={MAX_COURSE_DAYS}
                    value={oaDays === '' ? undefined : Number(oaDays)}
                    onChange={(v) => setOaDays(v === undefined ? '' : String(v))}
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

        {error && <InlineError>{error}</InlineError>}
      </div>
    </OrganizerStepCard>
  )
}
