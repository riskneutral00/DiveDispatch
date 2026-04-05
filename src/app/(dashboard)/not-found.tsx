import Link from 'next/link'
import { Search } from 'lucide-react'
import { ErrorCard } from '@/components/ui/error-card'

export default function DashboardNotFound() {
  return (
    <ErrorCard
      icon={Search}
      iconColor="var(--color-text-secondary)"
      title="Page not found"
      message="This page doesn't exist or has been moved."
      minHeight="min-h-[60vh]"
      action={
        <Link
          href="/account"
          className="text-sm font-medium underline"
          style={{ color: 'var(--color-text-link, var(--color-primary))' }}
        >
          Back to dashboard
        </Link>
      }
    />
  )
}
