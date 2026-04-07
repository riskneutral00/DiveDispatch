'use client'

import { createContext, useContext, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { deriveDefaultRole } from '@/lib/utils/role'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
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
  const user = useQuery(api.users.me)
  const userRoles = useQuery(api.userRoles.myRoles)
  const { user: convexUser } = useCurrentUser()
  const router = useRouter()

  const defaultRole =
    userRoles && userRoles.length > 0 ? deriveDefaultRole(userRoles.map((r) => r.role)) : null
  const roleConfig = defaultRole ? ROLE_BY_CLERK_ROLE[defaultRole as ClerkRole] : undefined
  const roleSlug = roleConfig?.key
  const slug = convexUser?.slug

  const contextValue = useMemo(
    () => roleSlug && slug ? { slug, roleSlug: roleSlug as RoleKey } : null,
    [slug, roleSlug],
  )

  useEffect(() => {
    if (user === null) {
      router.replace('/sign-up')
    }
  }, [user, router])

  if (user === undefined) {
    return <FullPageSpinner label={t('loading')} />
  }

  if (user === null) {
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
