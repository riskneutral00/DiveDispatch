'use client'

import { useQuery, useMutation } from 'convex/react'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import { ALL_LANGUAGES, languageToCode } from '@/lib/constants/dive-languages'
import { LanguageField } from '@/components/common/language-field'
import { FormSectionHeader } from '@/components/common/form-section-header'
import { SaveButton } from '@/components/common/save-button'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

// ── Exported for testing ────────────────────────────────────────────────────

export type PreferencesValues = {
  appLanguage: string
}

export const preferencesTabSchema = z.object({
  appLanguage: z.string().min(1, 'Language is required'),
})

export const PREFERENCES_DEFAULTS: PreferencesValues = {
  appLanguage: 'en',
}

export function preferencesFromUser(p: Record<string, unknown>): PreferencesValues {
  return {
    appLanguage: (typeof p.appLanguage === 'string' ? p.appLanguage : '') || 'en',
  }
}

export function preferencesToPayload(form: PreferencesValues) {
  return {
    role: 'DiveCenter' as const,
    appLanguage: form.appLanguage,
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function PreferencesTab() {
  const user = useQuery(api.users.me)
  const createUser = useMutation(api.users.createUser)

  const { form, setField, serverError, saving, saved, isDirty, isUpdate, handleSubmit, loading } = useProfileForm<PreferencesValues, ReturnType<typeof preferencesToPayload>>({
    profile: user as Record<string, unknown> | null | undefined,
    schema: preferencesTabSchema,
    defaults: PREFERENCES_DEFAULTS,
    fromProfile: preferencesFromUser,
    toPayload: preferencesToPayload,
    create: (payload) => createUser(payload),
    update: (payload) => createUser(payload),
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm animate-pulse text-secondary">
          Loading…
        </span>
      </div>
    )
  }

  const selectedLocaleObj = ALL_LANGUAGES.find((l) => l.code === languageToCode(form.appLanguage))
  const selectedLocale = selectedLocaleObj
    ? [{ code: selectedLocaleObj.code, label: selectedLocaleObj.label }]
    : []

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <FormSectionHeader label="App Preferences" />

        <LanguageField
          variant="app"
          value={selectedLocale}
          onChange={(langs) => {
            if (langs[0]) setField('appLanguage', langs[0].code)
          }}
        />
      </div>

      {serverError && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{serverError}</p>
      )}

      <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={isUpdate} />
    </form>
  )
}
