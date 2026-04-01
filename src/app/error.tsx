'use client'

import { useTranslations } from 'next-intl'
import { RouteErrorPage } from '@/components/layout/route-error-page'

export default function RootError({
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
      logLabel="Root Error"
      title={t('root.title')}
      message={t('root.message')}
      minHeight="min-h-screen"
    />
  )
}
