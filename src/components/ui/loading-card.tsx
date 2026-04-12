import { LoadingState } from '@/components/ui/loading-state'

interface LoadingCardProps {
  message?: string
  variant?: 'pulse' | 'spinner'
}

export function LoadingCard({ message, variant = 'pulse' }: LoadingCardProps) {
  return <LoadingState scope="card" variant={variant} message={message} />
}
