'use client'

import { useTranslations } from 'next-intl'
import { useDashboardSession } from '@/lib/hooks/use-dashboard-session'
import { useGuardedRedirect } from '@/lib/hooks/use-guarded-redirect'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'

export default function DashboardRedirectPage() {
  const t = useTranslations('common')
  const { redirectPath, status } = useDashboardSession()

  useGuardedRedirect({ to: redirectPath, enabled: status !== 'loading' })

  return <FullPageSpinner label={t('loading')} />
}
