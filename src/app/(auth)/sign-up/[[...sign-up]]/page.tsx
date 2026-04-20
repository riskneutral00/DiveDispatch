'use client'

import { useEffect, useState } from 'react'
import { SignUp, useOrganizationList } from '@clerk/nextjs'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleConfig } from '@/lib/constants/roles'
import { deriveDefaultRole, deriveRoleClass } from '@/lib/utils/role'
import { InlineError } from '@/components/ui/inline-error'
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

const SIGNUP_STEPS = [
  { key: 'signup', label: 'Sign Up' },
  { key: 'role', label: 'Role' },
  { key: 'profile', label: 'Profile' },
] as const

type PostAuthStage = 'role' | 'profile'
type OrgPhase = 'idle' | 'creating' | 'syncing' | 'done'

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
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const user = useQuery(api.users.me)
  const userRoles = useQuery(api.userRoles.myRoles)
  const createUser = useMutation(api.users.createUser)
  const router = useRouter()
  const { createOrganization, setActive, isLoaded: orgListLoaded } = useOrganizationList()
  const orgRow = useQuery(
    api.organizations.getBySlug,
    user?.slug ? { slug: user.slug } : 'skip',
  )

  const [appLanguage, setAppLanguageState] = useState<string>(DEFAULT_LOCALE)
  const [selectedRoles, setSelectedRoles] = useState<RoleConfig[]>([])
  const [stage, setStage] = useState<PostAuthStage>('role')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [phone, setPhone] = useState('')
  const [nickname, setNickname] = useState('')
  const [tcAccepted, setTcAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [orgPhase, setOrgPhase] = useState<OrgPhase>('idle')

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- comments-ok reads localStorage on mount; SSR-safe (default locale used during hydration) */
    setAppLanguageState(readInitialAppLanguage())
  }, [])

  useEffect(() => {
    if (orgPhase !== 'idle') return
    if (!user || !userRoles || userRoles.length === 0) return
    if (!orgListLoaded || !createOrganization || !setActive) return
    if (orgRow === undefined) return
    if (orgRow !== null) {
      setOrgPhase('done')
      return
    }

    const roleClass = deriveRoleClass(userRoles.map((r) => r.role) as ClerkRole[])
    if (roleClass !== 'freelance') return

    const userSlug = user.slug
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || userSlug
    setOrgPhase('creating')
    ;(async () => {
      try {
        const org = await createOrganization({ name: fullName, slug: userSlug })
        await setActive({ organization: org.id })
        setOrgPhase('syncing')
      } catch (err) {
        setError(parseConvexErrorI18n(err, tErr))
        setOrgPhase('idle')
        setSubmitting(false)
      }
    })()
  }, [orgPhase, user, userRoles, orgListLoaded, createOrganization, setActive, orgRow, tErr])

  useEffect(() => {
    if (orgPhase !== 'syncing') return
    if (orgRow) setOrgPhase('done')
  }, [orgPhase, orgRow])

  useEffect(() => {
    if (orgPhase !== 'done') return
    if (!user || !userRoles || userRoles.length === 0) return
    const defaultRole = deriveDefaultRole(userRoles.map((r) => r.role))
    const roleConfig = defaultRole ? ROLE_BY_CLERK_ROLE[defaultRole as ClerkRole] : undefined
    if (roleConfig) {
      router.replace(`/${user.slug}/${roleConfig.key}/dashboard`)
    } else {
      router.replace('/dashboard')
    }
  }, [orgPhase, user, userRoles, router])

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
          <StepIndicator steps={SIGNUP_STEPS} currentIndex={0} />
        </div>
        <div className="w-full mb-6">
          <LanguageField
            variant="app"
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

  if (user === undefined) {
    return <Spinner label={t('loading')} />
  }

  if (user) {
    return <Spinner label={t('redirecting')} />
  }

  const currentIndex = stage === 'role' ? 1 : 2

  return (
    <>
      <div className="w-full mb-6">
        <StepIndicator steps={SIGNUP_STEPS} currentIndex={currentIndex} />
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
        <InlineError centered className="mt-2">
          {error}
        </InlineError>
      )}
    </>
  )
}
