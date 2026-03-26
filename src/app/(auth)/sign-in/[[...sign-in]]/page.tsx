'use client'

import { useEffect } from 'react'
import { SignIn } from '@clerk/nextjs'
import { useConvexAuth, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../../convex/_generated/api'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { Spinner } from '@/components/common/spinner'
import { clerkGlassAppearance } from '../../clerk-glass-appearance'
import { deriveDefaultRole } from '../../../../../convex/lib/rolePrecedence'

export default function SignInPage() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const user = useQuery(api.users.me)
  const userRoles = useQuery(api.userRoles.myRoles)
  const router = useRouter()

  // Any user with a record → dashboard (banner handles incomplete profile)
  useEffect(() => {
    if (user && userRoles && userRoles.length > 0) {
      const defaultRole = deriveDefaultRole(userRoles.map((r) => r.role))
      const roleConfig = ROLE_BY_CLERK_ROLE[defaultRole as ClerkRole]
      router.replace(roleConfig ? `/${user.slug}/${roleConfig.key}` : '/dashboard')
    }
  }, [user, userRoles, router])

  // Authenticated but no Convex record → pick a role
  useEffect(() => {
    if (isAuthenticated && user === null) {
      router.replace('/sign-up')
    }
  }, [isAuthenticated, user, router])

  if (authLoading) {
    return <Spinner label="Loading…" />
  }

  // Not authenticated → show Clerk sign-in form
  if (!isAuthenticated) {
    return (
      <SignIn
        fallbackRedirectUrl="/dashboard"
        appearance={clerkGlassAppearance}
      />
    )
  }

  // Authenticated — query loading or routing in progress
  if (user === undefined) {
    return <Spinner label="Loading…" />
  }

  // Authenticated — redirecting via useEffect
  return <Spinner label="Redirecting…" />
}
