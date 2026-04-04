import { Card } from '@/components/ui/card'

interface LoadingCardProps {
  /** Text shown while loading. Default: Unicode ellipsis (Loading…). */
  message?: string
}

/**
 * Centered loading indicator inside a Card.
 * Replaces the 10+ identical Card + pulse patterns across
 * dashboard steps, profile forms, and portal components.
 */
export function LoadingCard({ message = 'Loading\u2026' }: LoadingCardProps) {
  return (
    <Card padding="lg">
      <div className="flex items-center justify-center py-8">
        <span className="text-sm animate-pulse text-secondary">
          {message}
        </span>
      </div>
    </Card>
  )
}
