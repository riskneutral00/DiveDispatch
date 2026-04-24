'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorCard } from '@/components/ui/error-card'

interface RouteErrorPageProps {
  reset: () => void
  title: string
  message: string
  size?: 'sm' | 'md'
}

export function RouteErrorPage({
  reset,
  title,
  message,
  size = 'md',
}: RouteErrorPageProps) {
  const t = useTranslations('common')

  return (
    <ErrorCard
      icon={AlertTriangle}
      title={title}
      message={message}
      size={size}
      action={<Button onClick={reset}>{t('retry')}</Button>}
    />
  )
}
