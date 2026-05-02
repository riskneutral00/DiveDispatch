'use client'

import { createContext, useContext, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { RoleKey } from '@/lib/constants/roles'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'
import { useDashboardSession } from '@/lib/hooks/use-dashboard-session'
import { useGuardedRedirect } from '@/lib/hooks/use-guarded-redirect'
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
  const { defaultRoleKey, slug, status, redirectPath } = useDashboardSession()

  useGuardedRedirect({
    to: redirectPath,
    enabled:
      status === 'unauthenticated' ||
      status === 'unprovisioned' ||
      status === 'no-role',
  })

  const contextValue = useMemo(
    () => (defaultRoleKey && slug ? { slug, roleSlug: defaultRoleKey } : null),
    [slug, defaultRoleKey],
  )

  if (status === 'loading') {
    return <FullPageSpinner label={t('loading')} />
  }

  if (
    status === 'unauthenticated' ||
    status === 'unprovisioned' ||
    status === 'no-role'
  ) {
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
