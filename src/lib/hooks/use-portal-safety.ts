'use client'

import { useMutation, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
// ── Types ───────────────────────────────────────────────────────────────────

interface UsePortalSafetyArgs {
  token: string
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Wraps the Convex API calls used by the portal safety step:
 * - `getSafetyInfoByToken` query (previously saved safety info)
 * - `saveSafetyInfo` mutation
 *
 * Keeps the `convex/` import boundary inside `lib/` so components
 * never import from `convex/` directly.
 */
export function usePortalSafety({ token }: UsePortalSafetyArgs) {
  const saved = useQuery(api.customerProfiles.getSafetyInfoByToken, { token })
  const save = useMutation(api.customerProfiles.saveSafetyInfo)

  return { saved, save }
}
