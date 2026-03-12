'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

// Returns the authenticated user from Convex, or null if not yet loaded / unauthenticated.
// Reactive — re-renders when the user document changes.
export function useCurrentUser() {
  const user = useQuery(api.users.me)
  const isLoading = user === undefined
  const isAuthenticated = user !== null && user !== undefined

  return { user: user ?? null, isLoading, isAuthenticated }
}
