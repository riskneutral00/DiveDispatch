'use client'

import { useMutation, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
// ── Types ───────────────────────────────────────────────────────────────────

interface UsePortalMedicalArgs {
  token: string
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Wraps the Convex API calls used by the portal medical step:
 * - `getMedicalByToken` query (previously saved medical answers)
 * - `saveMedicalAnswers` mutation
 *
 * Keeps the `convex/` import boundary inside `lib/` so components
 * never import from `convex/` directly.
 */
export function usePortalMedical({ token }: UsePortalMedicalArgs) {
  const saved = useQuery(api.customerProfiles.getMedicalByToken, { token })
  const save = useMutation(api.customerProfiles.saveMedicalAnswers)

  return { saved, save }
}
