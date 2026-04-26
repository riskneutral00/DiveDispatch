'use client'

import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'

export function useDirectoryByRoleKey(roleKey: RoleKey | null | undefined) {
  const clerkRole = roleKey ? ROLE_BY_KEY[roleKey]?.clerkRole : undefined
  return useQuery(api.directory.listByRole, clerkRole ? { role: clerkRole } : 'skip')
}
