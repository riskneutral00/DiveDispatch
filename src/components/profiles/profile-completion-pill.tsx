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
      className="flex items-center gap-2 cursor-pointer rounded-full px-3 py-1 urgent-pulse"
      style={{
        background: 'var(--color-glass-bg)',
        backdropFilter: 'blur(var(--glass-blur, 12px))',
        WebkitBackdropFilter: 'blur(var(--glass-blur, 12px))',
        border: '1px solid var(--color-warning)',
        boxShadow: '0 0 12px rgba(251, 191, 36, 0.35), 0 4px 12px var(--color-glass-shadow)',
      }}
      aria-label={`Profile ${percentage}% complete — click to complete your profile`}
    >
      <span
        className="text-xs font-semibold whitespace-nowrap"
        style={{ color: 'var(--color-warning)' }}
      >
        Complete your profile
      </span>
      <RadialProgress percentage={percentage} />
    </button>
  )
}
