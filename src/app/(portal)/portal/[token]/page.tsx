'use client'

import { useParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Clock, Link2Off } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import { Button } from '@/components/ui/button'
import { ErrorCard } from '@/components/ui/error-card'
import { Spinner } from '@/components/ui/spinner'
import { PostTripPage } from '@/components/portal/post-trip-page'
import { PortalActiveFlow } from '@/components/portal/portal-active-flow'

export default function PortalTokenPage() {
  const t = useTranslations('portal')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const params = useParams()
  const token = typeof params.token === 'string' ? params.token : ''

  const result = useQuery(api.bookingLinks.getByToken, token ? { token } : 'skip')
  const progress = useQuery(api.portalDraft.getPortalProgress, token ? { token } : 'skip')

  if (result === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-primary">
        <Spinner size="lg" label={tCommon('loading')} />
      </div>
    )
  }

  if (result.status === 'expired' || result.status === 'not_found') {
    return (
      <ErrorCard
        icon={Link2Off}
        iconColor="var(--color-text-secondary)"
        title={tErrors('linkExpiredTitle')}
        message={t('tokenExpired')}
      />
    )
  }

  if (result.status === 'completed') {
    const datePart = result.startDate
      ? t('dateSuffix', { date: result.startDate })
      : ''
    const body = result.operatorName
      ? t('submissionComplete.withOperator', {
          operatorName: result.operatorName,
          datePart,
        })
      : t('submissionComplete.withoutOperator', { datePart })

    return (
      <ErrorCard
        icon={CheckCircle2}
        iconColor="var(--color-success)"
        title={tErrors('completeTitle')}
        message={`${result.customerName} — ${body}`}
        action={
          <Button variant="primary" size="md" onClick={() => window.close()}>
            {tCommon('close')}
          </Button>
        }
      />
    )
  }

  if (result.status === 'post_trip') {
    return (
      <PostTripPage
        operatorName={result.operatorName}
        startDate={result.startDate}
        endDate={result.endDate}
      />
    )
  }

  if (result.status === 'closed') {
    return (
      <ErrorCard
        icon={Clock}
        iconColor="var(--color-warning)"
        title={tErrors('bookingClosedTitle')}
        message={t('bookingClosed')}
      />
    )
  }

  return (
    <PortalActiveFlow
      token={token}
      customerName={result.customerName}
      operatorName={result.operatorName}
      activityType={result.activityType}
      startDate={result.startDate}
      endDate={result.endDate}
      diverCount={result.diverCount}
      progress={progress}
    />
  )
}
