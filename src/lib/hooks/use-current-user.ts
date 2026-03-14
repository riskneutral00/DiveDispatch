'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useConvexAuth } from 'convex/react'
import { useUser } from '@clerk/nextjs'
import { api } from '../../../convex/_generated/api'

const VALID_ROLES = new Set([
  'DiveCenter',
  'Agent',
  'Instructor',
  'Boat',
  'Equipment',
  'Pool',
  'Compressor',
  'DiveMaster',
  'Liveaboard',
  'DiveResort',
  'DiveHostel',
  'DiveSite',
])

// Returns the authenticated user from Convex, or null if not yet loaded / unauthenticated.
// Reactive — re-renders when the user document changes.
// Auto-provisions Convex user from Clerk metadata when missing (e.g. after wipe).
export function useCurrentUser() {
  const user = useQuery(api.users.me)
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const { user: clerkUser } = useUser()
  const createUser = useMutation(api.users.createUser)
  const provisionAttempted = useRef(false)
  const [provisioning, setProvisioning] = useState(false)

  useEffect(() => {
    if (authLoading || !isAuthenticated || user !== null || provisionAttempted.current) return

    const meta = clerkUser?.unsafeMetadata as Record<string, unknown> | undefined
    const role = meta?.role
    const businessName = meta?.businessName

    if (
      typeof role !== 'string' ||
      !VALID_ROLES.has(role) ||
      typeof businessName !== 'string' ||
      !businessName.trim()
    ) return

    provisionAttempted.current = true
    setProvisioning(true)

    createUser({
      role: role as 'DiveCenter',
      businessName,
    })
      .catch(() => {
        // Fall through — user stays null, redirect to /role-select
      })
      .finally(() => setProvisioning(false))
  }, [authLoading, isAuthenticated, user, clerkUser, createUser])

  const isLoading = user === undefined || provisioning

  return { user: user ?? null, isLoading, isAuthenticated: user !== null && user !== undefined }
}
