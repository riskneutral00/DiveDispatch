'use client'

import { useEffect, useState } from 'react'
import { SignIn, useClerk } from '@clerk/nextjs'
import { Spinner } from '@/components/ui/spinner'
import { clerkGlassAppearance } from '../../clerk-glass-appearance'

export default function SignInPage() {
  const clerk = useClerk()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!clerk?.loaded) return
    const staleSignUpId = clerk.client?.signUp?.id
    if (staleSignUpId && !clerk.session) {
      clerk.client!
        .destroy()
        .catch(() => {})
        .finally(() => setReady(true))
      return
    }
    setReady(true)
  }, [clerk, clerk?.loaded])

  if (!ready) return <Spinner />

  return (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/dashboard"
      appearance={clerkGlassAppearance}
    />
  )
}
