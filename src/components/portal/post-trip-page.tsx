'use client'

import { useTranslations } from 'next-intl'
import { Star, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface PostTripPageProps {
  operatorName: string
  startDate: string
  endDate: string
}

export function PostTripPage({ operatorName }: PostTripPageProps) {
  const t = useTranslations('portal.postTrip')

  return (
    <div className="flex min-h-screen items-center justify-center p-4" data-testid="post-trip-page">
      <Card className="max-w-md w-full text-center" padding="lg">
        <div className="mb-4 flex justify-center">
          <Star size={40} style={{ color: 'var(--color-warning)' }} />
        </div>

        <p
          className="text-sm font-medium uppercase tracking-widest text-secondary mb-2"
        >
          {operatorName}
        </p>

        <h1
          className="text-xl font-semibold mb-2 text-primary"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {t('title')}
        </h1>

        <p className="text-sm leading-relaxed mb-6 text-secondary">
          {t('subtitle')}
        </p>

        <p className="text-sm font-medium mb-4 text-primary">
          {t('reviewPrompt')}
        </p>

        <div className="flex flex-col gap-3 mb-8">
          <a
            href="https://maps.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full"
          >
            <Button variant="secondary" size="md" fullWidth>
              <ExternalLink size={16} />
              {t('googleMaps')}
            </Button>
          </a>

          <a
            href="https://www.facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full"
          >
            <Button variant="secondary" size="md" fullWidth>
              <ExternalLink size={16} />
              {t('facebook')}
            </Button>
          </a>
        </div>

        <p className="text-sm text-secondary mb-3">
          {t('signupPrompt')}
        </p>

        <a href="/sign-up">
          <Button variant="primary" size="md" fullWidth>
            {t('signupCta')}
          </Button>
        </a>
      </Card>
    </div>
  )
}
