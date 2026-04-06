'use client'

import { SignIn } from '@clerk/nextjs'
import { clerkGlassAppearance } from '../../clerk-glass-appearance'

// Clerk handles post-auth redirect via fallbackRedirectUrl="/dashboard".
// The proxy resolves /dashboard → /{slug}/{role}/dashboard from session claims.
export default function SignInPage() {
  return (
    <SignIn
      fallbackRedirectUrl="/dashboard"
      appearance={clerkGlassAppearance}
    />
  )
}
