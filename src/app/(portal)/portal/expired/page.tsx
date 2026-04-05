import { Link2Off } from 'lucide-react'
import { ErrorCard } from '@/components/ui/error-card'

// Static page — no client-side JS needed.
export default function PortalExpiredPage() {
  return (
    <ErrorCard
      icon={Link2Off}
      iconColor="var(--color-text-secondary)"
      title="Link Expired"
      message="This link is no longer valid. Please contact your dive center for a new one."
    />
  )
}
