'use client'

import { SignIn } from '@clerk/nextjs'
import { clerkGlassAppearance } from '../../clerk-glass-appearance'

export default function SignInPage() {
  return (
    <SignIn
      fallbackRedirectUrl="/dashboard"
      appearance={clerkGlassAppearance}
    />
  )
}
