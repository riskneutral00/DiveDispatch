'use client'

import { RouteErrorPage } from '@/components/layout/route-error-page'

export default function DashboardError({
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
      logLabel="Dashboard Error"
      title="Something went wrong"
      message="An unexpected error occurred. Try refreshing or contact support if this persists."
      minHeight="min-h-[60vh]"
    />
  )
}
