import { Card } from '@/components/ui/card'

interface ProfileIncompleteGuardProps {
  message?: string
}

/** Shown in secondary profile tabs when the primary contact section hasn't been saved yet. */
export function ProfileIncompleteGuard({
  message = 'Complete contact info first',
}: ProfileIncompleteGuardProps) {
  return (
    <Card padding="md">
      <p className="text-sm text-secondary">{message}</p>
    </Card>
  )
}
