import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

interface LoadingCardProps {
  message?: string
  variant?: 'pulse' | 'spinner'
}

export function LoadingCard({ message = 'Loading\u2026', variant = 'pulse' }: LoadingCardProps) {
  return (
    <Card padding="lg">
      <div className="flex items-center justify-center py-8">
        {variant === 'spinner' ? (
          <Spinner label={message} />
        ) : (
          <span className="text-body animate-pulse text-secondary">
            {message}
          </span>
        )}
      </div>
    </Card>
  )
}
