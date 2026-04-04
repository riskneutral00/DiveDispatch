import Link from 'next/link'
import { Search } from 'lucide-react'
import { ErrorCard } from '@/components/ui/error-card'

export default function PortalNotFound() {
  return (
    <ErrorCard
      icon={Search}
      iconColor="var(--color-text-secondary)"
      title="Page not found"
      message="The page you're looking for doesn't exist or has been moved."
      minHeight="min-h-screen"
      action={
        <Link
          href="/"
          className="text-sm font-medium underline"
          style={{ color: 'var(--color-text-link, var(--color-primary))' }}
        >
          Back to home
        </Link>
      }
    />
  )
}
