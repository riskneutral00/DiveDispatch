'use client'

import { useQuery, useMutation } from 'convex/react'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import { ALL_LANGUAGES, languageToCode } from '@/lib/constants/dive-languages'
import { LanguageField } from '@/components/profiles/language-field'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
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
    appLanguage: form.appLanguage,
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function PreferencesTab() {
  const user = useQuery(api.users.me)
  const createUser = useMutation(api.users.createUser)
  const updateProfile = useMutation(api.users.updateProfile)

  const {
    form,
    setField,
    footerErrorMessage,
    saving,
    saved,
    isDirty,
    isValid,
    isUpdate,
    handleSubmit,
    loading,
  } = useProfileForm<PreferencesValues, ReturnType<typeof preferencesToPayload>>({
    profile: user as Record<string, unknown> | null | undefined,
    schema: preferencesTabSchema,
    defaults: PREFERENCES_DEFAULTS,
    fromProfile: preferencesFromUser,
    toPayload: preferencesToPayload,
    create: (payload) => createUser({ ...payload, role: 'DiveCenter' }),
    update: (payload) => updateProfile(payload),
  })

  const selectedLocaleObj = ALL_LANGUAGES.find((l) => l.code === languageToCode(form.appLanguage))
  const selectedLocale = selectedLocaleObj
    ? [{ code: selectedLocaleObj.code, label: selectedLocaleObj.label }]
    : []

  return (
    <ProfileFormShell
      loading={loading}
      onSubmit={handleSubmit}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      disableSaveWhenInvalid
      isValid={isValid}
      loadingVariant="pulse-text"
      className="space-y-6"
    >
      <div className="space-y-4">
        <LanguageField
          variant="app"
          value={selectedLocale}
          onChange={(langs) => {
            if (langs[0]) setField('appLanguage', langs[0].code)
          }}
        />
      </div>
    </ProfileFormShell>
  )
}
