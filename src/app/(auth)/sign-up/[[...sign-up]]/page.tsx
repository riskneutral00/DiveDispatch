'use client'

import { useEffect, useState } from 'react'
import { SignUp } from '@clerk/nextjs'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import { type RoleConfig } from '@/lib/constants/roles'
import { InlineError } from '@/components/ui/inline-error'
import { Spinner } from '@/components/ui/spinner'
import { StepIndicator } from '@/components/ui/step-indicator'
import { StepRoleSelection } from '@/components/onboarding/step-role-selection'
import { clerkGlassAppearance } from '../../clerk-glass-appearance'
import { parseConvexErrorI18n } from '@/lib/utils/convex-error'

const SIGNUP_STEPS = [
  { key: 'signup', label: 'Sign Up' },
  { key: 'role', label: 'Role' },
] as const

export default function SignUpPage() {
  const t = useTranslations('common')
  const tAuth = useTranslations('auth')
  const tErr = useTranslations('errors')
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const user = useQuery(api.users.me)
  const userRoles = useQuery(api.userRoles.myRoles)
  const createUser = useMutation(api.users.createUser)
  const router = useRouter()

  const [selectedRoles, setSelectedRoles] = useState<RoleConfig[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user && userRoles && userRoles.length > 0) {
      router.replace('/dashboard')
    }
  }, [user, userRoles, router])

  function toggleRole(role: RoleConfig) {
    setSelectedRoles((prev) =>
      prev.some((r) => r.key === role.key)
        ? prev.filter((r) => r.key !== role.key)
        : [...prev, role],
    )
  }

  async function handleRoleSubmit() {
    if (!selectedRoles.length) return
    const primaryRole = selectedRoles[0]

    setSubmitting(true)
    setError('')

    try {
      await createUser({
        role: primaryRole.clerkRole,
        roles: selectedRoles.map((r) => r.clerkRole),
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
    return (
      <>
        <div className="w-full mb-6">
          <StepIndicator steps={SIGNUP_STEPS} currentIndex={0} />
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

  return (
    <>
      <div className="w-full mb-6">
        <StepIndicator steps={SIGNUP_STEPS} currentIndex={1} />
      </div>

      <StepRoleSelection
        selectedRoles={selectedRoles}
        onToggle={toggleRole}
        onBack={() => {}} // no back from role step — they already signed up
        onContinue={handleRoleSubmit}
      />
      {submitting && <Spinner label={tAuth('creatingAccount')} />}
      {error && <InlineError centered className="mt-2">{error}</InlineError>}
    </>
  )
}
