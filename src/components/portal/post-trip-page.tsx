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
      <Card centered className="max-w-md w-full" padding="lg">
        <div className="mb-4 flex justify-center">
          <Star size={40} style={{ color: 'var(--color-warning)' }} />
        </div>

        <p
          className="text-body font-medium uppercase tracking-widest text-secondary mb-2"
        >
          {operatorName}
        </p>

        <h1
          className="text-xl font-semibold mb-2 text-primary font-heading"
        >
          {t('title')}
        </h1>

        <p className="text-body leading-relaxed mb-6 text-secondary">
          {t('subtitle')}
        </p>

        <p className="text-body font-medium mb-4 text-primary">
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
              Review on Google Maps
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
              Review on Facebook
            </Button>
          </a>
        </div>

        <p className="text-body text-secondary mb-3">
          {t('signupPrompt')}
        </p>

        <a href="/sign-up">
          <Button variant="primary" size="md" fullWidth>
            Sign Up for DiveDispatch
          </Button>
        </a>
      </Card>
    </div>
  )
}
