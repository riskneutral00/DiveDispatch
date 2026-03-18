import { SignUp } from '@clerk/nextjs'
import { clerkGlassAppearance } from '../../clerk-glass-appearance'

export default function SignUpPage() {
  return (
    <SignUp
      fallbackRedirectUrl="/account"
      appearance={clerkGlassAppearance}
    />
  )
}
