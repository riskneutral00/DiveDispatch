import { GlassCard } from '@/components/glass/glass-card'

interface LoadingCardProps {
  /** Text shown while loading. Default: 'Loading...' */
  message?: string
}

/**
 * Centered loading indicator inside a GlassCard.
 * Replaces the 10+ identical GlassCard + pulse patterns across
 * dashboard steps, profile forms, and portal components.
 */
export function LoadingCard({ message = 'Loading\u2026' }: LoadingCardProps) {
  return (
    <GlassCard padding="lg">
      <div className="flex items-center justify-center py-8">
        <span className="text-sm animate-pulse text-secondary">
          {message}
        </span>
      </div>
    </GlassCard>
  )
}
