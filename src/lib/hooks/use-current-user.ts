'use client'

import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

// Returns the authenticated user from Convex, or null if not yet loaded / unauthenticated.
// Reactive — re-renders when the user document changes.
// When user is null (after query resolves): caller should redirect to /sign-up for onboarding.
export function useCurrentUser() {
  const user = useQuery(api.users.me)
  const { isLoading: authLoading } = useConvexAuth()

  // undefined = still loading; null = authenticated but no Convex user yet
  const isLoading = authLoading || user === undefined

  return { user: user ?? null, isLoading, isAuthenticated: user !== null && user !== undefined }
}
