'use client'

import { RouteErrorPage } from '@/components/layout/route-error-page'

export default function RootError({
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
      logLabel="Root Error"
      title="Something went wrong"
      message="An unexpected error occurred. Try refreshing the page or contact support if this persists."
      minHeight="min-h-screen"
    />
  )
}
