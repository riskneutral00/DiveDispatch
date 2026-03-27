'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { ALL_LANGUAGES } from '@/lib/constants/dive-languages'
import { COMMUNICATION_CHANNELS, type ChannelKey } from '@/lib/constants/communication-channels'
import { LanguageField } from '@/components/common/language-field'
import { FormSectionHeader } from '@/components/common/form-section-header'
import { GlassInput } from '@/components/glass/glass-input'
import { SaveButton } from '@/components/common/save-button'

interface ProfileValues {
  businessName: string
  contactEmail: string
  phone: string
  preferredLocale: string
  preferredChannel: ChannelKey | null
}

export function ProfileTab() {
  const user = useQuery(api.users.me)
  const createUser = useMutation(api.users.createUser)

  const [values, setValues] = useState<ProfileValues>({
    businessName: '',
    contactEmail: '',
    phone: '',
    preferredLocale: 'en',
    preferredChannel: null,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const baselineRef = useRef<ProfileValues | null>(null)

  useEffect(() => {
    if (user) {
      const loaded: ProfileValues = {
        businessName: user.businessName ?? '',
        contactEmail: user.email ?? '',
        phone: user.phone ?? '',
        preferredLocale: user.preferredLocale ?? 'en',
        preferredChannel: (user.preferredChannel as ChannelKey | null) ?? null,
      }
      setValues(loaded)
      baselineRef.current = loaded
    }
  }, [user])

  const isDirty = baselineRef.current !== null && JSON.stringify(values) !== JSON.stringify(baselineRef.current)

  function set<K extends keyof ProfileValues>(field: K, value: ProfileValues[K]) {
    setValues((v) => ({ ...v, [field]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.businessName.trim()) return
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      await createUser({
        role: 'DiveCenter',
        businessName: values.businessName.trim(),
        phone: values.phone.trim() || undefined,
        preferredLocale: values.preferredLocale,
        preferredChannel: values.preferredChannel ?? undefined,
      })
      baselineRef.current = { ...values }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
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

  const selectedLocaleObj = ALL_LANGUAGES.find((l) => l.code === values.preferredLocale)
  const selectedLocale = selectedLocaleObj
    ? [{ code: selectedLocaleObj.code, label: selectedLocaleObj.label }]
    : []

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Profile Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Your public identity across all roles.
        </p>
      </div>

      <div className="space-y-4">
        <FormSectionHeader label="Identity" />
        <div className="max-w-md">
          <GlassInput
            label="Name"
            value={values.businessName}
            onChange={(e) => set('businessName', e.target.value)}
            placeholder="Your name or business name"
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassInput
            label="Contact Email"
            type="email"
            value={values.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
            disabled
          />
          <GlassInput
            label="Phone"
            type="tel"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+66 81 234 5678"
          />
        </div>
      </div>

      <hr className="form-divider" />

      <div className="space-y-4">
        <FormSectionHeader label="App Preferences" />
        <LanguageField
          label="App language"
          value={selectedLocale}
          onChange={(langs) => {
            if (langs[0]) set('preferredLocale', langs[0].code)
          }}
          max={1}
        />

        <div>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Preferred communication channel
          </p>
          <div className="flex flex-wrap gap-2">
            {COMMUNICATION_CHANNELS.map((ch) => {
              const active = values.preferredChannel === ch.key
              return (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => set('preferredChannel', active ? null : ch.key)}
                  className="px-3 py-1.5 rounded-full text-sm transition-colors border cursor-pointer"
                  style={{
                    background: active ? 'var(--color-glass-bg-elevated)' : 'transparent',
                    borderColor: active ? 'var(--color-primary)' : 'var(--color-glass-border)',
                    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    transitionDuration: 'var(--transition-speed)',
                  }}
                >
                  {ch.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{error}</p>
      )}

      <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={true} />
    </form>
  )
}
