'use client'

import { useTranslations } from 'next-intl'
import { IconButton } from '@/components/ui/icon-button'
import { RadialProgress } from '@/components/onboarding/radial-progress'

interface ProfileCompletionBadgeProps {
  percentage: number
  onOpenOverlay: () => void
}

export function ProfileCompletionBadge({ percentage, onOpenOverlay }: ProfileCompletionBadgeProps) {
  const t = useTranslations('nav')
  return (
    <IconButton
      variant="ghost"
      onClick={onOpenOverlay}
      aria-label={t('profileProgress', { percentage })}
    >
      <RadialProgress percentage={percentage} />
    </IconButton>
  )
}
