'use client'

import { SignIn } from '@clerk/nextjs'
import { useConvexAuth } from 'convex/react'
import { useTranslations } from 'next-intl'
import { Spinner } from '@/components/ui/spinner'
import { clerkGlassAppearance } from '../../clerk-glass-appearance'

export default function SignInPage() {
  const t = useTranslations('common')
  const { isLoading: authLoading } = useConvexAuth()

  if (authLoading) {
    return <Spinner label={t('loading')} />
  }

  // Clerk handles post-auth redirect via fallbackRedirectUrl="/dashboard".
  // The proxy resolves /dashboard → /{slug}/{role}/dashboard from session claims.
  return (
    <SignIn
      fallbackRedirectUrl="/dashboard"
      appearance={clerkGlassAppearance}
    />
  )
}
