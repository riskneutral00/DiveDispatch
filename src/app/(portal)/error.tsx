'use client'

import { useTranslations } from 'next-intl'
import { RouteErrorPage } from '@/components/layout/route-error-page'

export default function PortalError({
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
      logLabel="Portal Error"
      title={t('portal.title')}
      message={t('portal.message')}
      minHeight="min-h-screen"
    />
  )
}
