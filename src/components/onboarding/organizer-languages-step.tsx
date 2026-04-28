'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSessionIdentity } from '@/lib/hooks/use-session-identity'
import { useMutationWithFeedback } from '@/lib/hooks/use-mutation-with-feedback'
import { InlineError, NumberPicker } from '@/components/ui'
import { LoadingCard } from '@/components/ui/loading-card'
import { resolveLanguages } from '@/lib/constants/dive-languages'
import { MAX_COURSE_DAYS } from '@/lib/constants/form-config'
import { LanguageField } from '@/components/ui/language-field'
import { SpecialtyField } from '@/components/profiles/specialty-field'
import type { Language } from '@/lib/types/language'
import { parseNumber } from '@/lib/utils/numbers'
import type { ClerkRole } from '@/lib/constants/roles'
import { useOrganizerRoleApi } from '@/lib/hooks/use-organizer-role-api'
import { getOrganizerRoleFlags } from '@/lib/constants/organizer-wizard-config'
import { OrganizerStepCard } from './organizer-step-card'
import { FieldRow } from '@/components/ui/field-row'

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
  const tCommon = useTranslations('common')
  const existing = useQuery(roleApi.mine)
  const { user: me } = useSessionIdentity()
  const update = useMutation(roleApi.update)

  const { supportsCoursePreferences } = getOrganizerRoleFlags(role)

  const [focusedLanguages, setFocusedLanguages] = useState<Language[]>([])
  const [owDays, setOwDays] = useState('')
  const [aowDays, setAowDays] = useState('')
  const [oaDays, setOaDays] = useState('')
  const [aowSpecialties, setAowSpecialties] = useState<string[]>([])
  const [initialized, setInitialized] = useState(false)
  const { execute: save, loading: saving, error } = useMutationWithFeedback(
    update,
    { errorFallback: 'Save failed' },
  )

  useEffect(() => {
    if (existing !== undefined && me !== undefined && !initialized) {
      const lang = existing as { customerLanguages?: string[] } | null | undefined
      const langCodes: string[] = lang?.customerLanguages ?? []
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
    let result: Awaited<ReturnType<typeof save>>
    if (supportsCoursePreferences) {
      const owDaysNum = owDays ? parseNumber(owDays, true) : undefined
      const aowDaysNum = aowDays ? parseNumber(aowDays, true) : undefined
      const oaDaysNum = oaDays ? parseNumber(oaDays, true) : undefined
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
      result = await save({
        associations: [patchedFirst, ...currentAssocs.slice(1)],
        customerLanguages: focusedLanguages.map((l) => l.code),
      })
    } else {
      result = await save({
        customerLanguages: focusedLanguages.map((l) => l.code),
      })
    }
    if (result.ok) onSaved()
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
                label={tCommon('customerLanguages')}
                required
                value={focusedLanguages}
                onChange={setFocusedLanguages}
                className="field-md"
              />
              <div>
                <p className="text-body font-medium mb-1 text-secondary">
                  Default Course Durations <span className="font-normal">(optional)</span>
                </p>
                <p className="text-label mb-3 text-secondary">
                  Used when creating bookings.
                </p>
                <FieldRow>
                  <NumberPicker
                    label="OW Days"
                    min={1}
                    max={MAX_COURSE_DAYS}
                    value={owDays === '' ? undefined : Number(owDays)}
                    onChange={(v) => setOwDays(v === undefined ? '' : String(v))}
                    className="field-xs"
                  />
                  <NumberPicker
                    label="AOW Days"
                    min={1}
                    max={MAX_COURSE_DAYS}
                    value={aowDays === '' ? undefined : Number(aowDays)}
                    onChange={(v) => setAowDays(v === undefined ? '' : String(v))}
                    className="field-xs"
                  />
                  <NumberPicker
                    label="Adv. Days"
                    min={1}
                    max={MAX_COURSE_DAYS}
                    value={oaDays === '' ? undefined : Number(oaDays)}
                    onChange={(v) => setOaDays(v === undefined ? '' : String(v))}
                    className="field-xs"
                  />
                </FieldRow>
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
              label={tCommon('customerLanguages')}
              required
              value={focusedLanguages}
              onChange={setFocusedLanguages}
              className="field-md"
            />
          </div>
        )}

        {error && <InlineError>{error}</InlineError>}
      </div>
    </OrganizerStepCard>
  )
}
