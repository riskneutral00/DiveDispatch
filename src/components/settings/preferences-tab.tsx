'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { ALL_LANGUAGES, languageToCode } from '@/lib/constants/dive-languages'
import { LanguageField } from '@/components/common/language-field'
import { FormSectionHeader } from '@/components/common/form-section-header'
import { toast } from 'sonner'
import { parseConvexError } from '@/lib/utils/convex-error'
import { SaveButton } from '@/components/common/save-button'

interface SettingsValues {
  appLanguage: string
}

export function PreferencesTab() {
  const user = useQuery(api.users.me)
  const createUser = useMutation(api.users.createUser)

  const [values, setValues] = useState<SettingsValues>({
    appLanguage: 'en',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const baselineRef = useRef<SettingsValues | null>(null)

  useEffect(() => {
    if (user) {
      const loaded: SettingsValues = {
        appLanguage: user.appLanguage ?? 'en',
      }
      setValues(loaded)
      baselineRef.current = loaded
    }
  }, [user])

  const isDirty = baselineRef.current !== null && JSON.stringify(values) !== JSON.stringify(baselineRef.current)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      await createUser({
        role: 'DiveCenter',
        appLanguage: values.appLanguage,
      })
      baselineRef.current = { ...values }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      toast.success('Preferences saved', { duration: 3000 })
    } catch (err) {
      const message = parseConvexError(err, 'Something went wrong.')
      setError(message)
      toast.error('Save failed', { description: message, duration: 5000 })
    } finally {
      setSaving(false)
    }
  }

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm animate-pulse" style={{ color: 'var(--color-text-secondary)' }}>
          Loading…
        </span>
      </div>
    )
  }

  const selectedLocaleObj = ALL_LANGUAGES.find((l) => l.code === languageToCode(values.appLanguage))
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
            if (langs[0]) setValues((v) => ({ ...v, appLanguage: langs[0].code }))
            setSaved(false)
          }}
        />
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{error}</p>
      )}

      <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={true} />
    </form>
  )
}
