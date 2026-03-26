'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { deriveDefaultRole } from '../../../../convex/lib/rolePrecedence'
import { COMMUNICATION_CHANNELS, type ChannelKey } from '@/lib/constants/communication-channels'
import { ALL_LANGUAGES } from '@/lib/constants/dive-languages'
import { LanguagePicker } from '@/components/common/language-picker'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassInput } from '@/components/glass/glass-input'
import { Spinner } from '@/components/common/spinner'
import { BgSwitcher } from '@/components/dashboard/bg-switcher'
import { ThemeSwitcher } from '@/components/dashboard/theme-switcher'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { UserMenu } from '@/components/dashboard/user-menu'
import { MobileTopNav } from '@/components/dashboard/mobile-top-nav'
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav'
import { useCurrentUser } from '@/lib/hooks/use-current-user'

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
}

export default function AccountPage() {
  const user = useQuery(api.users.me)
  const userRoles = useQuery(api.userRoles.myRoles)
  const { user: convexUser } = useCurrentUser()
  const router = useRouter()
  const createUser = useMutation(api.users.createUser)

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
      })
    }
  }, [user])

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    )
  }

  if (user === null) {
    router.replace('/sign-up')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Redirecting…" />
      </div>
    )
  }

  const defaultRole = userRoles && userRoles.length > 0
    ? deriveDefaultRole(userRoles.map((r) => r.role))
    : null
  const roleConfig = defaultRole ? ROLE_BY_CLERK_ROLE[defaultRole as ClerkRole] : undefined
  const hasPersonalOnlyRole = roleConfig && PERSONAL_ROLE_KEYS.has(roleConfig.key)
  const showBusinessName = !hasPersonalOnlyRole

  const roleSlug = roleConfig?.key
  const slug = convexUser?.slug
  if (!roleSlug || !slug) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    )
  }

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
    <>
      {/* Desktop top bar */}
      <header
        className="hidden md:flex items-center justify-between gap-2 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-glass-border)' }}
      >
        <Link
          href={`/${slug}/${roleSlug}`}
          className="flex items-center gap-1 text-sm transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ChevronLeft size={16} />
          Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <BgSwitcher />
          <NotificationBell />
          <UserMenu roleSlug={roleSlug} slug={slug} />
        </div>
      </header>

      {/* Mobile top nav */}
      <MobileTopNav roleSlug={roleSlug} slug={slug} />

      {/* Page content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">
        <div className="w-full max-w-lg mx-auto">
          <div className="mb-6">
            <h1
              className="font-bold mb-1"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-page-title)' }}
            >
              Account
            </h1>
            {roleConfig && (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {roleConfig.label}
              </p>
            )}
          </div>

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
                {saved ? 'Saved ✓' : 'Save Changes'}
              </GlassButton>
            </div>
          </form>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav roleSlug={roleSlug} slug={slug} />
    </>
  )
}
