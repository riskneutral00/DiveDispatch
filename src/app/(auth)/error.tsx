'use client'

import { useTranslations } from 'next-intl'
import { RouteErrorPage } from '@/components/layout/route-error-page'

export default function AuthError({
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
      logLabel="Auth Error"
      title={t('auth.title')}
      message={t('auth.message')}
      minHeight="min-h-[60vh]"
    />
  )
}
