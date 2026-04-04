import Link from 'next/link'
import { Search } from 'lucide-react'
import { ErrorCard } from '@/components/ui/error-card'

export default function AuthNotFound() {
  return (
    <ErrorCard
      icon={Search}
      iconColor="var(--color-text-secondary)"
      title="Page not found"
      message="The page you're looking for doesn't exist or has been moved."
      minHeight="min-h-[60vh]"
      action={
        <Link
          href="/sign-in"
          className="text-sm font-medium underline"
          style={{ color: 'var(--color-text-link, var(--color-primary))' }}
        >
          Back to sign in
        </Link>
      }
    />
  )
}
