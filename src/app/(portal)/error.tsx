'use client'

import { RouteErrorPage } from '@/components/layout/route-error-page'

export default function PortalError({
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
      logLabel="Portal Error"
      title="Something went wrong"
      message="We couldn't load your booking form. Please try the link again or contact your dive center."
      minHeight="min-h-screen"
    />
  )
}
