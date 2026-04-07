import { Card } from '@/components/ui/card'

interface LoadingCardProps {
  message?: string
}

export function LoadingCard({ message = 'Loading\u2026' }: LoadingCardProps) {
  return (
    <Card padding="lg">
      <div className="flex items-center justify-center py-8">
        <span className="text-body animate-pulse text-secondary">
          {message}
        </span>
      </div>
    </Card>
  )
}
