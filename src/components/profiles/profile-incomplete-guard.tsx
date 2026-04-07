import { Card } from '@/components/ui/card'

interface ProfileIncompleteGuardProps {
  message?: string
}

export function ProfileIncompleteGuard({
  message = 'Complete contact info first',
}: ProfileIncompleteGuardProps) {
  return (
    <Card padding="md">
      <p className="text-body text-secondary">{message}</p>
    </Card>
  )
}
