import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { ErrorCard } from '@/components/ui/error-card'

interface NotFoundCardProps {
  href: string
  linkText: string
  message?: string
  size?: 'sm' | 'md'
}

export function NotFoundCard({
  href,
  linkText,
  message,
  size = 'sm',
}: NotFoundCardProps) {
  const tErrors = useTranslations('errors')

  return (
    <ErrorCard
      icon={Search}
      iconColor="var(--color-text-secondary)"
      title={tErrors('pageNotFound')}
      message={message ?? tErrors('pageNotFoundMessage')}
      size={size}
      action={
        <Link
          href={href}
          className="text-body font-medium underline"
          style={{ color: 'var(--color-text-link, var(--color-primary))' }} // design-ok — cascading var() fallback
        >
          {linkText}
        </Link>
      }
    />
  )
}
