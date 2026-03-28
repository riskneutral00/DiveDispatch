'use client'

import { createContext, useContext, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { deriveDefaultRole } from '../../../convex/lib/rolePrecedence'
import { Spinner } from '@/components/common/spinner'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { DashboardShell } from './dashboard-shell'

export interface SessionRoleContextValue {
  slug: string
  roleSlug: RoleKey
}

const SessionRoleContext = createContext<SessionRoleContextValue | null>(null)

/** Present when rendered inside {@link SessionDashboardShell} (global routes). */
export function useSessionRoleContext(): SessionRoleContextValue | null {
  return useContext(SessionRoleContext)
}

/**
 * Resolves the signed-in user’s default role slug + slug from Convex (same rules as `/account`)
 * and wraps children in {@link DashboardShell}. Use for global `(dashboard)` routes that are
 * not under `/[slug]/[roleSlug]` so they share chrome, overlays, and role switchers.
 */
export function SessionDashboardShell({ children }: { children: React.ReactNode }) {
  const user = useQuery(api.users.me)
  const userRoles = useQuery(api.userRoles.myRoles)
  const { user: convexUser } = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (user === null) {
      router.replace('/sign-up')
    }
  }, [user, router])

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    )
  }

  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Redirecting…" />
      </div>
    )
  }

  const defaultRole =
    userRoles && userRoles.length > 0 ? deriveDefaultRole(userRoles.map((r) => r.role)) : null
  const roleConfig = defaultRole ? ROLE_BY_CLERK_ROLE[defaultRole as ClerkRole] : undefined
  const roleSlug = roleConfig?.key
  const slug = convexUser?.slug

  if (!roleSlug || !slug) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    )
  }

  const contextValue = useMemo(
    () => ({ slug, roleSlug: roleSlug as RoleKey }),
    [slug, roleSlug],
  )

  return (
    <SessionRoleContext.Provider value={contextValue}>
      <DashboardShell roleSlug={roleSlug as RoleKey} slug={slug}>
        {children}
      </DashboardShell>
    </SessionRoleContext.Provider>
  )
}
