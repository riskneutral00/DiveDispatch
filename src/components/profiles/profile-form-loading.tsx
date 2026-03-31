'use client'

import { Spinner } from '@/components/ui/spinner'

export type ProfileFormLoadingVariant = 'spinner' | 'pulse-text' | 'plain'

interface ProfileFormLoadingProps {
  /** Visual style; default `spinner`. */
  variant?: ProfileFormLoadingVariant
  /** For `plain`: short line (e.g. equipment). For `pulse-text`: full sentence. */
  message?: string
  className?: string
  /** Outer padding (Tailwind), default `py-16`. */
  paddingClassName?: string
}

/**
 * Consistent loading state for Convex-backed profile forms.
 */
export function ProfileFormLoading({
  variant = 'spinner',
  message,
  className = '',
  paddingClassName = 'py-16',
}: ProfileFormLoadingProps) {
  if (variant === 'plain') {
    return <p className={`text-sm text-secondary ${className}`.trim()}>{message ?? 'Loading…'}</p>
  }

  if (variant === 'pulse-text') {
    return (
      <div className={`flex items-center justify-center ${paddingClassName} ${className}`.trim()}>
        <span className="text-sm animate-pulse text-secondary">
          {message ?? 'Loading profile…'}
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
