import { Link2Off } from 'lucide-react'
import { ErrorCard } from '@/components/ui/error-card'

// Static page — no client-side JS needed.
export default function PortalExpiredPage() {
  return (
    <ErrorCard
      icon={Link2Off}
      iconColor="var(--color-text-secondary)"
      title="This link has expired"
      message="Your portal link is no longer valid. Please contact the dive operator who sent you this link to request a new one."
    />
  )
}
