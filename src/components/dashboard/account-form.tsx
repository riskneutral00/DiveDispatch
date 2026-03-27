'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { deriveDefaultRole } from '../../../convex/lib/rolePrecedence'
import { COMMUNICATION_CHANNELS, type ChannelKey } from '@/lib/constants/communication-channels'
import { ALL_LANGUAGES } from '@/lib/constants/dive-languages'
import { LanguageField } from '@/components/common/language-field'
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
  email: string
  phone: string
  preferredLocale: string
  preferredChannel: ChannelKey | null
  defaultLocation: string
  email: string
  phone: string
}

interface AccountFormProps {
  showSharedDefaults?: boolean
  showAppPreferences?: boolean
}

export function AccountForm({
  showSharedDefaults = true,
  showAppPreferences = true,
}: AccountFormProps = {}) {
  const user = useQuery(api.users.me)
  const userRoles = useQuery(api.userRoles.myRoles)
  const createUser = useMutation(api.users.createUser)
  const updateDefaults = useMutation(api.users.updateAccountDefaults)

  const [values, setValues] = useState<AccountFormValues>({
    firstName: '',
    lastName: '',
    nickname: '',
    businessName: '',
    email: '',
    phone: '',
    preferredLocale: 'en',
    preferredChannel: null,
    defaultLocation: '',
    email: '',
    phone: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const baselineRef = useRef<AccountFormValues | null>(null)

  useEffect(() => {
    if (user) {
      const loaded: AccountFormValues = {
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        nickname: user.nickname ?? '',
        businessName: user.businessName ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
        preferredLocale: user.preferredLocale ?? 'en',
        preferredChannel: (user.preferredChannel as ChannelKey | null) ?? null,
        defaultLocation: user.defaultLocation ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
      }
      setValues(loaded)
      baselineRef.current = loaded
    }
  }, [user])

  const isDirty = baselineRef.current !== null && JSON.stringify(values) !== JSON.stringify(baselineRef.current)

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner label="Loading…" />
      </div>
    )
  }

  if (!user) return null

  const defaultRole = userRoles && userRoles.length > 0
    ? deriveDefaultRole(userRoles.map((r) => r.role))
    : null
  const roleConfig = defaultRole ? ROLE_BY_CLERK_ROLE[defaultRole as ClerkRole] : undefined
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
        role: (defaultRole ?? 'DiveCenter') as ClerkRole,
        businessName,
        firstName: values.firstName.trim() || undefined,
        lastName: values.lastName.trim() || undefined,
        nickname: values.nickname.trim() || undefined,
        phone: values.phone.trim() || undefined,
        preferredLocale: values.preferredLocale,
        preferredChannel: values.preferredChannel ?? undefined,
      })
      await updateDefaults({
        defaultLocation: values.defaultLocation.trim() || undefined,
        email: values.email.trim() || undefined,
        phone: values.phone.trim() || undefined,
      })
      baselineRef.current = { ...values }
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

          <div className={showBusinessName ? 'grid grid-cols-2 gap-4' : undefined}>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              label="Contact email"
              type="email"
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
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

      {showSharedDefaults && (
        <>
          <hr className="form-divider" />
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

              <div className="max-w-md">
                <GlassInput
                  label="Default location"
                  value={values.defaultLocation}
                  onChange={(e) => set('defaultLocation', e.target.value)}
                  placeholder="e.g. Koh Tao, Thailand"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <GlassInput
                  label="Default contact email"
                  type="email"
                  value={values.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="your@business.com"
                  autoComplete="email"
                />
                <GlassInput
                  label="Default contact phone"
                  type="tel"
                  value={values.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+66 81 234 5678"
                  autoComplete="tel"
                />
              </div>
            </div>
          </GlassCard>
        </>
      )}

      <hr className="form-divider" />

      {showAppPreferences && (
        <>
          <hr className="form-divider" />
          <GlassCard>
            <div className="flex flex-col gap-5">
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                App Preferences
              </p>

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
          </GlassCard>
        </>
      )}

      {error && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <GlassButton
          type="submit"
          variant="primary"
          disabled={!isComplete || !isDirty || submitting}
          loading={submitting}
        >
          {saved ? 'Saved' : 'Save Changes'}
        </GlassButton>
      </div>
    </form>
  )
}
