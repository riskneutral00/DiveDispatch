'use client'

import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils/cn'

export type LoadingStateVariant = 'pulse' | 'spinner' | 'bar'
export type LoadingStateScope = 'inline' | 'card' | 'page'

interface LoadingStateProps {
  variant?: LoadingStateVariant
  scope?: LoadingStateScope
  message?: string
  className?: string
}

export function LoadingState({
  variant = 'spinner',
  scope = 'inline',
  message,
  className,
}: LoadingStateProps) {
  const t = useTranslations('common')
  const label = message ?? t('loading')

  const body =
    variant === 'bar' ? (
      <div
        role="progressbar"
        aria-label={label}
        className="h-1 w-full overflow-hidden rounded-full bg-glass-border"
      >
        <span className="block h-full w-1/3 animate-pulse bg-primary" />
      </div>
    ) : variant === 'pulse' ? (
      <span className="text-body animate-pulse text-secondary">{label}</span>
    ) : (
      <Spinner size="lg" label={label} />
    )

  if (scope === 'card') {
    return (
      <Card
        padding="lg"
        className={cn('flex items-center justify-center py-8', className)}
      >
        {body}
      </Card>
    )
  }

  if (scope === 'page') {
    return (
      <div
        className={cn(
          'min-h-screen flex items-center justify-center',
          className,
        )}
      >
        {body}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center', className)}>
      {body}
    </div>
  )
}
