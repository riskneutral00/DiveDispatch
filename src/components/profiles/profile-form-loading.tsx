'use client'

import { useTranslations } from 'next-intl'
import { Spinner } from '@/components/ui/spinner'

export type ProfileFormLoadingVariant = 'spinner' | 'pulse-text' | 'plain'

interface ProfileFormLoadingProps {
  variant?: ProfileFormLoadingVariant
  message?: string
  className?: string
  paddingClassName?: string
}

export function ProfileFormLoading({
  variant = 'spinner',
  message,
  className = '',
  paddingClassName = 'py-16',
}: ProfileFormLoadingProps) {
  const t = useTranslations('common')
  if (variant === 'plain') {
    return (
      <p className={`text-body text-secondary ${className}`.trim()}>{message ?? t('loading')}</p>
    )
  }

  if (variant === 'pulse-text') {
    return (
      <div className={`flex items-center justify-center ${paddingClassName} ${className}`.trim()}>
        <span className="text-body animate-pulse text-secondary">
          {message ?? t('loading')}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-center ${paddingClassName} text-primary ${className}`.trim()}
    >
      <Spinner size="lg" />
    </div>
  )
}
