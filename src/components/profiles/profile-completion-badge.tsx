'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { RadialProgress } from '@/components/onboarding/radial-progress'

interface ProfileCompletionBadgeProps {
  percentage: number
  onOpenOverlay: () => void
}

export function ProfileCompletionBadge({ percentage, onOpenOverlay }: ProfileCompletionBadgeProps) {
  const t = useTranslations('nav')
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onOpenOverlay}
      className="p-0 rounded-full"
      aria-label={t('profileProgress', { percentage })}
    >
      <RadialProgress percentage={percentage} />
    </Button>
  )
}
