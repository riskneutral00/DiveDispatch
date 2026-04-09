'use client'

import { Button } from '@/components/ui/button'
import { RadialProgress } from '@/components/onboarding/radial-progress'

interface ProfileCompletionPillProps {
  percentage: number
  onOpenOverlay: () => void
}

export function ProfileCompletionPill({ percentage, onOpenOverlay }: ProfileCompletionPillProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onOpenOverlay}
      className="rounded-full urgent-pulse"
      style={{
        border: '1px solid var(--color-warning)',
        boxShadow: '0 0 12px var(--color-warning-glow), 0 4px 12px var(--color-glass-shadow)',
      }}
      aria-label={`${percentage}% complete`}
    >
      <span
        className="text-label font-semibold whitespace-nowrap text-warning"
      >
        Complete profile
      </span>
      <RadialProgress percentage={percentage} />
    </Button>
  )
}
