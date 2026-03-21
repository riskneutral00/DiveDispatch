'use client'

import { useEffect, useState } from 'react'
import { SignUp } from '@clerk/nextjs'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../../convex/_generated/api'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleConfig } from '@/lib/constants/roles'
import { Spinner } from '@/components/common/spinner'
import { StepIndicator } from '@/components/common/step-indicator'
import { StepRoleSelection } from '@/components/onboarding/step-role-selection'
import { StepProfileSetup, type ProfileFormValues } from '@/components/onboarding/step-profile-setup'
import { clerkGlassAppearance } from '../../clerk-glass-appearance'

const WIZARD_STEPS = [
  { key: 'signup', label: 'Sign Up' },
  { key: 'role', label: 'Role' },
  { key: 'profile', label: 'Profile' },
]

export default function SignUpPage() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const user = useQuery(api.users.me)
  const createUser = useMutation(api.users.createUser)
  const router = useRouter()

  const [selectedRoles, setSelectedRoles] = useState<RoleConfig[]>([])
  const [wizardStep, setWizardStep] = useState<'role' | 'profile'>('role')
  const [submitting, setSubmitting] = useState(false)
  const [redirectPending, setRedirectPending] = useState(false)
  const [error, setError] = useState('')

  // Redirect once the Convex user record appears after createUser
  useEffect(() => {
    if (!redirectPending || !user) return
    const roleConfig = ROLE_BY_CLERK_ROLE[user.role as ClerkRole]
    if (roleConfig) {
      router.replace(`/${roleConfig.key}/${user.slug}/dashboard`)
    }
  }, [redirectPending, user, router])

  // Completed user visiting /sign-up → dashboard
  useEffect(() => {
    if (user && user.businessName) {
      const roleConfig = ROLE_BY_CLERK_ROLE[user.role as ClerkRole]
      if (roleConfig) {
        router.replace(`/${roleConfig.key}/${user.slug}/dashboard`)
      }
    }
  }, [user, router])

  function toggleRole(role: RoleConfig) {
    setSelectedRoles((prev) =>
      prev.some((r) => r.key === role.key)
        ? prev.filter((r) => r.key !== role.key)
        : [...prev, role],
    )
  }

  async function handleProfileSubmit(values: ProfileFormValues) {
    if (!selectedRoles.length) return
    const primaryRole = selectedRoles[0]
    const businessName = values.businessName.trim() || `${values.firstName} ${values.lastName}`

    setSubmitting(true)
    setError('')

    try {
      await createUser({
        role: primaryRole.clerkRole,
        businessName,
      })
      setRedirectPending(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      )
      setSubmitting(false)
    }
  }

  // ── Determine which step to show ────────────────────────────────────────────

  // Still loading auth state
  if (authLoading) {
    return <Spinner label="Loading…" />
  }

  // Not authenticated → Step 1: Clerk sign-up
  if (!isAuthenticated) {
    return (
      <>
        <div className="w-full mb-6">
          <StepIndicator steps={WIZARD_STEPS} currentIndex={0} />
        </div>
        <SignUp
          fallbackRedirectUrl="/sign-up"
          appearance={clerkGlassAppearance}
        />
      </>
    )
  }

  // Authenticated — waiting for Convex user query
  if (user === undefined) {
    return <Spinner label="Loading…" />
  }

  // Authenticated + completed user → redirect (handled by useEffect, show spinner)
  if (user && user.businessName) {
    return <Spinner label="Redirecting…" />
  }

  // Authenticated, no Convex user → Steps 2-3
  const currentIndex = wizardStep === 'role' ? 1 : 2

  return (
    <>
      <div className="w-full mb-6">
        <StepIndicator steps={WIZARD_STEPS} currentIndex={currentIndex} />
      </div>

      {wizardStep === 'role' ? (
        <StepRoleSelection
          selectedRoles={selectedRoles}
          onToggle={toggleRole}
          onContinue={() => setWizardStep('profile')}
        />
      ) : (
        <StepProfileSetup
          selectedRoles={selectedRoles}
          initialValues={{
            firstName: '',
            lastName: '',
            businessName: '',
            city: '',
            country: '',
            contactEmail: '',
            contactPhone: '',
          }}
          onBack={() => setWizardStep('role')}
          onSubmit={handleProfileSubmit}
          submitting={submitting || redirectPending}
          error={error}
        />
      )}
    </>
  )
}
