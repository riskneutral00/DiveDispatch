'use client'

import { RadialProgress } from '@/components/onboarding/radial-progress'

interface ProfileCompletionPillProps {
  percentage: number
  onOpenOverlay: () => void
}

export function ProfileCompletionPill({ percentage, onOpenOverlay }: ProfileCompletionPillProps) {
  return (
    <button
      onClick={onOpenOverlay}
      className="flex items-center gap-2 cursor-pointer rounded-full px-3 py-1 urgent-pulse glass"
      style={{
        border: '1px solid var(--color-warning)',
        boxShadow: '0 0 12px var(--color-warning-glow), 0 4px 12px var(--color-glass-shadow)',
      }}
      aria-label={`${percentage}% complete`}
    >
      <span
        className="text-xs font-semibold whitespace-nowrap"
        style={{ color: 'var(--color-warning)' }}
      >
        Complete profile
      </span>
      <RadialProgress percentage={percentage} />
    </button>
  )
}
