'use client'

import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
export function useCurrentUser() {
  const user = useQuery(api.users.me)
  const { isLoading: authLoading } = useConvexAuth()

  const isLoading = authLoading || user === undefined

  return { user: user ?? null, isLoading, isAuthenticated: user !== null && user !== undefined }
}
