import { Badge } from '@/components/ui/badge'
import { statusVariant } from '@/lib/booking/booking-display'

interface StatusBadgeProps {
  status: string
  dot?: boolean
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, dot, size }: StatusBadgeProps) {
  return (
    <Badge variant={statusVariant(status)} dot={dot} size={size}>
      {status}
    </Badge>
  )
}
