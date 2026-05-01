'use client'

import { useMemo } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import type { UserDoc, UserRoleDoc } from '@/lib/convex-generated'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { deriveDefaultRole } from '@/lib/utils/role'
import { useStoreUserStatus } from './store-user-context'

export type SessionStatus = 'loading' | 'unauthenticated' | 'ready'

export interface SessionIdentity {
  user: UserDoc | null | undefined
  roles: UserRoleDoc[] | undefined
  defaultRole: ClerkRole | null
  defaultRoleKey: RoleKey | null
  slug: string | null
  status: SessionStatus
  isAuthLoading: boolean
  isAuthenticated: boolean
}

export function useSessionIdentity(): SessionIdentity {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth()
  const storeStatus = useStoreUserStatus()
  const user = useQuery(api.users.me)
  const roles = useQuery(api.userRoles.myRoles)

  return useMemo<SessionIdentity>(() => {
    let status: SessionStatus
    if (isAuthLoading || storeStatus === 'pending' || user === undefined || roles === undefined) {
      status = 'loading'
    } else if (user === null) {
      status = 'unauthenticated'
    } else {
      status = 'ready'
    }

    const defaultRole =
      roles && roles.length > 0
        ? (deriveDefaultRole(roles.map((r) => r.role)) as ClerkRole | null)
        : null
    const defaultRoleKey = defaultRole ? (ROLE_BY_CLERK_ROLE[defaultRole]?.key ?? null) : null

    return {
      user,
      roles,
      defaultRole,
      defaultRoleKey,
      slug: user?.slug ?? null,
      status,
      isAuthLoading,
      isAuthenticated,
    }
  }, [user, roles, isAuthLoading, isAuthenticated, storeStatus])
}
