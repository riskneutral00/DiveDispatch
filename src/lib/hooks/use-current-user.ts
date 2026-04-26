'use client'

import { useSessionIdentity } from './use-session-identity'

export function useCurrentUser() {
  const { user, status } = useSessionIdentity()
  return {
    user: user ?? null,
    isLoading: status === 'loading',
    isAuthenticated: user !== null && user !== undefined,
  }
}
