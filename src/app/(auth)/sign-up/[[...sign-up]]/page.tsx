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
import { clerkGlassAppearance } from '../../clerk-glass-appearance'

export const SIGNUP_STEPS = [
  { key: 'signup', label: 'Sign Up' },
  { key: 'role', label: 'Role' },
] as const

export default function SignUpPage() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const user = useQuery(api.users.me)
  const createUser = useMutation(api.users.createUser)
  const router = useRouter()

  const [selectedRoles, setSelectedRoles] = useState<RoleConfig[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Any user with a record → dashboard (banner handles incomplete state)
  useEffect(() => {
    if (user) {
      const roleConfig = ROLE_BY_CLERK_ROLE[user.role as ClerkRole]
      router.replace(roleConfig ? `/${user.slug}/${roleConfig.key}` : '/dashboard')
    }
  }, [user, router])

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
      await createUser({ role: primaryRole.clerkRole })
      // The user useEffect above will redirect to dashboard once the record appears
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      )
      setSubmitting(false)
    }
  }

  // ── Determine which step to show ────────────────────────────────────────────

  if (authLoading) {
    return <Spinner label="Loading…" />
  }

  // Not authenticated → Step 1: Clerk sign-up
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

  // Authenticated — waiting for Convex user query
  if (user === undefined) {
    return <Spinner label="Loading…" />
  }

  // User record exists — redirecting via useEffect
  if (user) {
    return <Spinner label="Redirecting…" />
  }

  // Authenticated, no Convex user → Step 2: Role selection
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
      {submitting && <Spinner label="Creating account…" />}
      {error && (
        <p className="text-sm mt-2 text-center" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
    </>
  )
}
