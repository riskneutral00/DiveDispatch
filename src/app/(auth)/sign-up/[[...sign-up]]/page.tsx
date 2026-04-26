'use client'

import { useEffect, useMemo, useState } from 'react'
import { SignUp, useOrganization } from '@clerk/nextjs'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import { type RoleConfig } from '@/lib/constants/roles'
import { useSessionIdentity } from '@/lib/hooks/use-session-identity'
import { ErrorAlert } from '@/components/ui/error-alert'
import { Spinner } from '@/components/ui/spinner'
import { StepIndicator } from '@/components/ui/step-indicator'
import { StepRoleSelection } from '@/components/onboarding/step-role-selection'
import { StepProfileCompletion } from '@/components/onboarding/step-profile-completion'
import { LanguageField } from '@/components/ui/language-field'
import { ALL_LANGUAGES, languageToCode } from '@/lib/constants/dive-languages'
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/constants/locales'
import { clerkGlassAppearance } from '../../clerk-glass-appearance'
import { parseConvexErrorI18n } from '@/lib/utils/convex-error'
import { CURRENT_TC_VERSION } from '@/../convex/shared/tcVersion'

type PostAuthStage = 'role' | 'profile'

const LOCALE_COOKIE = 'dd-locale'
const LANG_PREF_STORAGE = 'dd-signup-lang-pref'

function readInitialAppLanguage(): string {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  const stored = window.sessionStorage.getItem(LANG_PREF_STORAGE)
  if (stored) return stored
  const found = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
    ?.split('=')[1]
  return normalizeLocale(found)
}

export default function SignUpPage() {
  const t = useTranslations('common')
  const tAuth = useTranslations('auth')
  const tErr = useTranslations('errors')
  const {
    user,
    roles: userRoles,
    defaultRoleKey,
    isAuthLoading: authLoading,
    isAuthenticated,
  } = useSessionIdentity()
  const createUser = useMutation(api.users.createUser)
  const router = useRouter()
  const { organization: activeOrg, isLoaded: orgLoaded } = useOrganization()

  const signupSteps = useMemo(
    () => [
      { key: 'signup', label: tAuth('stepSignUp') },
      { key: 'role', label: tAuth('stepRole') },
      { key: 'profile', label: tAuth('stepProfile') },
    ],
    [tAuth],
  )

  const [appLanguage, setAppLanguageState] = useState<string>(DEFAULT_LOCALE)
  const [selectedRoles, setSelectedRoles] = useState<RoleConfig[]>([])
  const [stage, setStage] = useState<PostAuthStage>('role')

  const orgLookupClerkId = activeOrg?.id ?? null

  const orgRow = useQuery(
    api.organizations.publicByClerkOrgId,
    orgLookupClerkId ? { clerkOrgId: orgLookupClerkId } : 'skip',
  )

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [phone, setPhone] = useState('')
  const [nickname, setNickname] = useState('')
  const [tcAccepted, setTcAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- comments-ok reads localStorage on mount; SSR-safe (default locale used during hydration) */
    setAppLanguageState(readInitialAppLanguage())
  }, [])

  useEffect(() => {
    if (!user) return
    if (!userRoles || userRoles.length === 0) return
    if (!orgRow) return
    if (defaultRoleKey) {
      router.replace(`/${user.slug}/${defaultRoleKey}/dashboard`)
    } else {
      router.replace('/dashboard')
    }
  }, [user, userRoles, defaultRoleKey, orgRow, router])

  function changeAppLanguage(code: string) {
    const cookieLocale = normalizeLocale(code)
    document.cookie = `${LOCALE_COOKIE}=${cookieLocale}; path=/; max-age=31536000; SameSite=Lax`
    window.sessionStorage.setItem(LANG_PREF_STORAGE, code)
    setAppLanguageState(code)
    router.refresh()
  }

  function toggleRole(role: RoleConfig) {
    setSelectedRoles((prev) =>
      prev.some((r) => r.key === role.key)
        ? prev.filter((r) => r.key !== role.key)
        : [...prev, role],
    )
  }

  function handleRoleContinue() {
    if (!selectedRoles.length) return
    setError('')
    setStage('profile')
  }

  async function handleProfileSubmit() {
    if (!selectedRoles.length) return
    if (!tcAccepted) return
    const primaryRole = selectedRoles[0]

    setSubmitting(true)
    setError('')

    try {
      await createUser({
        role: primaryRole.clerkRole,
        roles: selectedRoles.map((r) => r.clerkRole),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth,
        tcAccepted: true,
        tcVersion: CURRENT_TC_VERSION,
        phone: phone.trim(),
        nickname: nickname.trim() || undefined,
        appLanguage,
      })
    } catch (err) {
      setError(parseConvexErrorI18n(err, tErr))
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return <Spinner label={t('loading')} />
  }

  if (!isAuthenticated) {
    const selectedLocaleObj = ALL_LANGUAGES.find(
      (l) => l.code === languageToCode(appLanguage),
    )
    const selectedLocale = selectedLocaleObj
      ? [{ code: selectedLocaleObj.code, label: selectedLocaleObj.label }]
      : []

    return (
      <>
        <div className="w-full mb-6">
          <StepIndicator steps={signupSteps} currentIndex={0} />
        </div>
        <div className="w-full mb-6">
          <LanguageField
            label={t('appLanguage')}
            max={1}
            required
            value={selectedLocale}
            onChange={(langs) => {
              if (langs[0]) changeAppLanguage(langs[0].code)
            }}
          />
        </div>
        <SignUp
          fallbackRedirectUrl="/sign-up"
          appearance={clerkGlassAppearance}
        />
      </>
    )
  }

  if (user === undefined || userRoles === undefined) {
    return <Spinner label={t('loading')} />
  }

  if (user && userRoles.length > 0) {
    if (!orgLoaded) {
      return <Spinner label={t('loading')} />
    }
    if (!activeOrg) {
      return <ErrorAlert>{tAuth('noActiveOrg')}</ErrorAlert>
    }
    if (!orgRow) {
      return <Spinner label={tAuth('syncingOrganization')} />
    }
    return <Spinner label={t('redirecting')} />
  }

  const currentIndex = stage === 'role' ? 1 : 2

  return (
    <>
      <div className="w-full mb-6">
        <StepIndicator steps={signupSteps} currentIndex={currentIndex} />
      </div>

      {stage === 'role' ? (
        <StepRoleSelection
          selectedRoles={selectedRoles}
          onToggle={toggleRole}
          onContinue={handleRoleContinue}
        />
      ) : (
        <StepProfileCompletion
          firstName={firstName}
          lastName={lastName}
          dateOfBirth={dateOfBirth}
          phone={phone}
          nickname={nickname}
          tcAccepted={tcAccepted}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
          onDateOfBirthChange={setDateOfBirth}
          onPhoneChange={setPhone}
          onNicknameChange={setNickname}
          onTcAcceptedChange={setTcAccepted}
          onBack={() => setStage('role')}
          onContinue={handleProfileSubmit}
          submitting={submitting}
          error={error}
        />
      )}
      {submitting && <Spinner label={tAuth('creatingAccount')} />}
      {stage === 'role' && error && (
        <ErrorAlert className="mt-2">{error}</ErrorAlert>
      )}
    </>
  )
}
