'use client'

import { useTranslations } from 'next-intl'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'

export default function DashboardLoading() {
  const t = useTranslations('common')
  return <FullPageSpinner label={t('loading')} />
}
