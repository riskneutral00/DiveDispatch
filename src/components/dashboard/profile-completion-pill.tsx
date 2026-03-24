'use client'

import { RadialProgress } from '@/components/onboarding/radial-progress'

interface ProfileCompletionPillProps {
  percentage: number
  onOpenOverlay: () => void
}

export function ProfileCompletionPill({ percentage, onOpenOverlay }: ProfileCompletionPillProps) {
  return (
    <div className="relative" style={{ zIndex: 50 }}>
      {/* Radial progress pill — clickable */}
      <button
        onClick={onOpenOverlay}
        className="cursor-pointer"
        aria-label={`Profile ${percentage}% complete — click to complete your profile`}
      >
        <RadialProgress percentage={percentage} />
      </button>

      {/* Comic speech bubble below the pill — urgent pulse animation */}
      <div
        onClick={onOpenOverlay}
        className="absolute cursor-pointer whitespace-nowrap urgent-pulse"
        style={{
          top: 'calc(100% + 10px)',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        {/* Upward-pointing arrow tail — large and visible */}
        <div
          style={{
            position: 'absolute',
            top: '-8px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: '8px solid var(--color-warning, #fbbf24)',
          }}
        />
        {/* Bubble body */}
        <div
          className="rounded-lg px-3.5 py-2 text-xs font-semibold"
          style={{
            background: 'var(--color-glass-bg, rgba(15, 23, 42, 0.8))',
            backdropFilter: 'blur(var(--glass-blur, 12px))',
            WebkitBackdropFilter: 'blur(var(--glass-blur, 12px))',
            border: '2px solid var(--color-warning, #fbbf24)',
            color: 'var(--color-warning, #fbbf24)',
            boxShadow: '0 0 12px rgba(251, 191, 36, 0.3), 0 4px 12px var(--color-glass-shadow, rgba(0, 0, 0, 0.2))',
          }}
        >
          Complete your profile
        </div>
      </div>
    </div>
  )
}
