'use client'

import { useTranslations } from 'next-intl'
import { RouteErrorPage } from '@/components/layout/route-error-page'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errors')

  return (
    <RouteErrorPage
      error={error}
      reset={reset}
      logLabel="Dashboard Error"
      title={t('dashboard.title')}
      message={t('dashboard.message')}
      minHeight="min-h-[60vh]"
    />
  )
}
