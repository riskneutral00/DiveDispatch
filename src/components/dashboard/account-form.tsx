'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { COMMUNICATION_CHANNELS, type ChannelKey } from '@/lib/constants/communication-channels'
import { ALL_LANGUAGES } from '@/lib/constants/dive-languages'
import { LanguagePicker } from '@/components/common/language-picker'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassInput } from '@/components/glass/glass-input'
import { Spinner } from '@/components/common/spinner'

const PERSONAL_ROLE_KEYS = new Set(['instructor', 'dive-master'])

interface AccountFormValues {
  firstName: string
  lastName: string
  nickname: string
  businessName: string
  contactEmail: string
  phone: string
  preferredLocale: string
  preferredChannel: ChannelKey | null
  customerLanguages: string[]
  defaultLocation: string
  defaultContactEmail: string
  defaultContactPhone: string
}

export function AccountForm() {
  const user = useQuery(api.users.me)
  const createUser = useMutation(api.users.createUser)
  const updateDefaults = useMutation(api.users.updateAccountDefaults)

  const [values, setValues] = useState<AccountFormValues>({
    firstName: '',
    lastName: '',
    nickname: '',
    businessName: '',
    contactEmail: '',
    phone: '',
    preferredLocale: 'en',
    preferredChannel: null,
    customerLanguages: [],
    defaultLocation: '',
    defaultContactEmail: '',
    defaultContactPhone: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setValues({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        nickname: user.nickname ?? '',
        businessName: user.businessName ?? '',
        contactEmail: user.email ?? '',
        phone: user.phone ?? '',
        preferredLocale: user.preferredLocale ?? 'en',
        preferredChannel: (user.preferredChannel as ChannelKey | null) ?? null,
        customerLanguages: user.customerLanguages ?? [],
        defaultLocation: user.defaultLocation ?? '',
        defaultContactEmail: user.defaultContactEmail ?? '',
        defaultContactPhone: user.defaultContactPhone ?? '',
      })
    }
  }, [user])

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner label="Loading…" />
      </div>
    )
  }

  if (!user) return null

  const roleConfig = ROLE_BY_CLERK_ROLE[user.role as ClerkRole]
  const hasPersonalOnlyRole = roleConfig && PERSONAL_ROLE_KEYS.has(roleConfig.key)
  const showBusinessName = !hasPersonalOnlyRole

  function set<K extends keyof AccountFormValues>(field: K, value: AccountFormValues[K]) {
    setValues((v) => ({ ...v, [field]: value }))
    setSaved(false)
  }

  const isComplete =
    values.firstName.trim() &&
    values.lastName.trim() &&
    (!showBusinessName || values.businessName.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isComplete) return
    setError('')
    setSaved(false)
    setSubmitting(true)
    try {
      const businessName = values.businessName.trim() || `${values.firstName} ${values.lastName}`
      await createUser({
        role: user!.role,
        businessName,
        firstName: values.firstName.trim() || undefined,
        lastName: values.lastName.trim() || undefined,
        nickname: values.nickname.trim() || undefined,
        phone: values.phone.trim() || undefined,
        preferredLocale: values.preferredLocale,
        preferredChannel: values.preferredChannel ?? undefined,
        customerLanguages: values.customerLanguages.length > 0 ? values.customerLanguages : undefined,
      })
      await updateDefaults({
        defaultLocation: values.defaultLocation.trim() || undefined,
        defaultContactEmail: values.defaultContactEmail.trim() || undefined,
        defaultContactPhone: values.defaultContactPhone.trim() || undefined,
        customerLanguages: values.customerLanguages.length > 0 ? values.customerLanguages : undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedLocaleObj = ALL_LANGUAGES.find((l) => l.code === values.preferredLocale)
  const selectedLocale = selectedLocaleObj
    ? [{ code: selectedLocaleObj.code, label: selectedLocaleObj.label }]
    : []

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <GlassCard>
        <div className="flex flex-col gap-4">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Identity
          </p>

          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="First name"
              value={values.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              autoComplete="given-name"
              required
            />
            <GlassInput
              label="Last name"
              value={values.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              autoComplete="family-name"
              required
            />
          </div>

          <GlassInput
            label="Nickname"
            value={values.nickname}
            onChange={(e) => set('nickname', e.target.value)}
            placeholder="What people call you"
            autoComplete="nickname"
          />

          {showBusinessName && (
            <GlassInput
              label="Business name"
              value={values.businessName}
              onChange={(e) => set('businessName', e.target.value)}
              autoComplete="organization"
              required
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              label="Contact email"
              type="email"
              value={values.contactEmail}
              onChange={(e) => set('contactEmail', e.target.value)}
              autoComplete="email"
            />
            <GlassInput
              label="Phone"
              type="tel"
              value={values.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+66 81 234 5678"
              autoComplete="tel"
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-col gap-4">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Shared Defaults
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            These values pre-fill new role profiles. Each role can override them.
          </p>

          <GlassInput
            label="Default location"
            value={values.defaultLocation}
            onChange={(e) => set('defaultLocation', e.target.value)}
            placeholder="e.g. Koh Tao, Thailand"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              label="Default contact email"
              type="email"
              value={values.defaultContactEmail}
              onChange={(e) => set('defaultContactEmail', e.target.value)}
              placeholder="your@business.com"
              autoComplete="email"
            />
            <GlassInput
              label="Default contact phone"
              type="tel"
              value={values.defaultContactPhone}
              onChange={(e) => set('defaultContactPhone', e.target.value)}
              placeholder="+66 81 234 5678"
              autoComplete="tel"
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-col gap-5">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            App Preferences
          </p>

          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              App language
            </p>
            <LanguagePicker
              value={selectedLocale}
              onChange={(langs) => {
                if (langs[0]) set('preferredLocale', langs[0].code)
              }}
              max={1}
            />
          </div>

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

          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Customer languages
            </p>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Languages you can serve customers in.
            </p>
            <LanguagePicker
              value={values.customerLanguages
                .map((code) => ALL_LANGUAGES.find((l) => l.code === code))
                .filter((l): l is NonNullable<typeof l> => l !== undefined)
                .map((l) => ({ code: l.code, label: l.label }))}
              onChange={(langs) => set('customerLanguages', langs.map((l) => l.code))}
            />
          </div>
        </div>
      </GlassCard>

      {error && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <GlassButton
          type="submit"
          variant="primary"
          disabled={!isComplete || submitting}
          loading={submitting}
        >
          {saved ? 'Saved' : 'Save Changes'}
        </GlassButton>
      </div>
    </form>
  )
}
