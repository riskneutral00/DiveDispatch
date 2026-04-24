'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { RouteErrorPage } from '@/components/layout/route-error-page'
import { reportError } from '@/lib/error-reporting'

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common')

  useEffect(() => {
    reportError(error, { boundary: 'Portal Error' })
  }, [error])

  return (
    <RouteErrorPage
      reset={reset}
      title={t('error')}
      message={t('errorContact')}
      size="md"
    />
  )
}
