'use client'

import { createContext, useContext, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { RoleKey } from '@/lib/constants/roles'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'
import { useSessionIdentity } from '@/lib/hooks/use-session-identity'
import { DashboardShell } from './dashboard-shell'

export interface SessionRoleContextValue {
  slug: string
  roleSlug: RoleKey
}

const SessionRoleContext = createContext<SessionRoleContextValue | null>(null)

export function useSessionRoleContext(): SessionRoleContextValue | null {
  return useContext(SessionRoleContext)
}

export function SessionDashboardShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common')
  const { defaultRoleKey, slug, status } = useSessionIdentity()
  const router = useRouter()

  const contextValue = useMemo(
    () => (defaultRoleKey && slug ? { slug, roleSlug: defaultRoleKey } : null),
    [slug, defaultRoleKey],
  )

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/sign-up')
    }
  }, [status, router])

  if (status === 'loading') {
    return <FullPageSpinner label={t('loading')} />
  }

  if (status === 'unauthenticated') {
    return <FullPageSpinner label={t('redirecting')} />
  }

  if (!contextValue) {
    return <FullPageSpinner label={t('loading')} />
  }

  return (
    <SessionRoleContext.Provider value={contextValue}>
      <DashboardShell roleSlug={contextValue.roleSlug} slug={contextValue.slug}>
        {children}
      </DashboardShell>
    </SessionRoleContext.Provider>
  )
}
