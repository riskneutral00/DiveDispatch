'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorCard } from '@/components/ui/error-card'
import { reportError } from '@/lib/error-reporting'

interface RouteErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
  logLabel: string
  title: string
  message: string
  minHeight: string
}

export function RouteErrorPage({
  error,
  reset,
  logLabel,
  title,
  message,
  minHeight,
}: RouteErrorPageProps) {
  const t = useTranslations('common')

  useEffect(() => {
    reportError(error, { boundary: logLabel })
  }, [error, logLabel])

  return (
    <ErrorCard
      icon={AlertTriangle}
      title={title}
      message={message}
      minHeight={minHeight}
      action={<Button onClick={reset}>{t('retry')}</Button>}
    />
  )
}
