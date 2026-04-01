'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { GlassButton } from '@/components/ui/glass-button'
import { GlassErrorCard } from '@/components/ui/glass-error-card'

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
    console.error(`[${logLabel}]`, error)
  }, [error, logLabel])

  return (
    <GlassErrorCard
      icon={AlertTriangle}
      title={title}
      message={message}
      minHeight={minHeight}
      action={<GlassButton onClick={reset}>{t('retry')}</GlassButton>}
    />
  )
}
