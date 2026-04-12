'use client'

import { LoadingState, type LoadingStateVariant } from '@/components/ui/loading-state'

export type ProfileFormLoadingVariant = 'spinner' | 'pulse-text' | 'plain'

const VARIANT_MAP: Record<ProfileFormLoadingVariant, LoadingStateVariant> = {
  spinner: 'spinner',
  'pulse-text': 'pulse',
  plain: 'pulse',
}

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
  return (
    <LoadingState
      variant={VARIANT_MAP[variant]}
      scope="inline"
      message={message}
      className={`${paddingClassName} ${className}`.trim()}
    />
  )
}
