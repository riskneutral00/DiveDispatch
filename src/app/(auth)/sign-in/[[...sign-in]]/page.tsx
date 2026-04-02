'use client'

import { useEffect } from 'react'
import { SignIn } from '@clerk/nextjs'
import { useConvexAuth, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/convex-generated'
import { Spinner } from '@/components/ui/spinner'
import { clerkGlassAppearance } from '../../clerk-glass-appearance'
import { resolveSignInRedirect } from '@/lib/utils/sign-in-redirect'

export default function SignInPage() {
  const t = useTranslations('common')
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const user = useQuery(api.users.me)
  const userRoles = useQuery(api.userRoles.myRoles)
  const router = useRouter()

  // Post-auth redirect: user with roles → dashboard, no record → sign-up
  useEffect(() => {
    const result = resolveSignInRedirect({ isAuthenticated, user, userRoles })
    if (result.action === 'redirect') {
      router.replace(result.path)
    }
  }, [user, userRoles, isAuthenticated, router])

  if (authLoading) {
    return <Spinner label={t('loading')} />
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
    return <Spinner label={t('loading')} />
  }

  // Authenticated — redirecting via useEffect
  return <Spinner label={t('redirecting')} />
}
