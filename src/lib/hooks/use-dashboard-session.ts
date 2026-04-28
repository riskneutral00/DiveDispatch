'use client'

import { useMemo } from 'react'
import {
  useSessionIdentity,
  type SessionIdentity,
} from './use-session-identity'
import {
  ROLE_BY_KEY,
  type ClerkRole,
  type RoleKey,
} from '@/lib/constants/roles'

export type DashboardStatus = 'loading' | 'unauthenticated' | 'no-role' | 'ready'

export type SlugMatch = 'ok' | 'mismatch' | 'unknown'
export type RoleMatch = 'ok' | 'mismatch' | 'unknown'

export interface DashboardSession {
  identity: SessionIdentity
  status: DashboardStatus
  user: SessionIdentity['user']
  roles: SessionIdentity['roles']
  slug: string | null
  defaultRoleKey: RoleKey | null
  defaultClerkRole: ClerkRole | null
  redirectPath: string | null
  hasRole: (clerkRole: ClerkRole) => boolean
  validateSlug: (slug: string | undefined) => SlugMatch
  validateRoleKey: (roleKey: RoleKey | undefined) => RoleMatch
}

export function useDashboardSession(): DashboardSession {
  const identity = useSessionIdentity()
  return useMemo<DashboardSession>(() => {
    let status: DashboardStatus
    if (identity.status === 'loading') status = 'loading'
    else if (identity.status === 'unauthenticated') status = 'unauthenticated'
    else if (!identity.defaultRoleKey || !identity.slug) status = 'no-role'
    else status = 'ready'

    let redirectPath: string | null = null
    if (status === 'unauthenticated' || status === 'no-role') {
      redirectPath = '/sign-up'
    } else if (status === 'ready' && identity.slug && identity.defaultRoleKey) {
      redirectPath = `/${identity.slug}/${identity.defaultRoleKey}/dashboard`
    }

    const hasRole = (clerkRole: ClerkRole) =>
      (identity.roles ?? []).some((r) => r.role === clerkRole)

    const validateSlug = (s: string | undefined): SlugMatch => {
      if (!identity.slug) return 'unknown'
      if (!s) return 'unknown'
      return identity.slug === s ? 'ok' : 'mismatch'
    }

    const validateRoleKey = (rk: RoleKey | undefined): RoleMatch => {
      if (!rk) return 'unknown'
      const cfg = ROLE_BY_KEY[rk]
      if (!cfg) return 'unknown'
      return hasRole(cfg.clerkRole as ClerkRole) ? 'ok' : 'mismatch'
    }

    return {
      identity,
      status,
      user: identity.user,
      roles: identity.roles,
      slug: identity.slug,
      defaultRoleKey: identity.defaultRoleKey,
      defaultClerkRole: identity.defaultRole,
      redirectPath,
      hasRole,
      validateSlug,
      validateRoleKey,
    }
  }, [identity])
}
