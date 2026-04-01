'use client'

import { RouteErrorPage } from '@/components/layout/route-error-page'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteErrorPage
      error={error}
      reset={reset}
      logLabel="Auth Error"
      title="Authentication error"
      message="Something went wrong during sign in. Please try again."
      minHeight="min-h-[60vh]"
    />
  )
}
