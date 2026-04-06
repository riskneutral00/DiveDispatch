import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { ErrorCard } from '@/components/ui/error-card'

interface NotFoundCardProps {
  href: string
  linkText: string
  message?: string
  minHeight?: string
}

export function NotFoundCard({
  href,
  linkText,
  message,
  minHeight = 'min-h-[60vh]',
}: NotFoundCardProps) {
  const tErrors = useTranslations('errors')

  return (
    <ErrorCard
      icon={Search}
      iconColor="var(--color-text-secondary)"
      title={tErrors('pageNotFound')}
      message={message ?? tErrors('pageNotFoundMessage')}
      minHeight={minHeight}
      action={
        <Link
          href={href}
          className="text-sm font-medium underline"
          style={{ color: 'var(--color-text-link, var(--color-primary))' }} // design-ok — cascading var() fallback
        >
          {linkText}
        </Link>
      }
    />
  )
}
