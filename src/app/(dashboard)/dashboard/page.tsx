'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useSessionIdentity } from '@/lib/hooks/use-session-identity'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'

export default function DashboardRedirectPage() {
  const t = useTranslations('common')
  const { user, defaultRoleKey, status } = useSessionIdentity()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!user) {
      router.replace('/sign-up')
      return
    }
    if (defaultRoleKey) {
      router.replace(`/${user.slug}/${defaultRoleKey}`)
      return
    }
    router.replace('/sign-up')
  }, [user, defaultRoleKey, status, router])

  return (
    <FullPageSpinner label={t('loading')} />
  )
}
