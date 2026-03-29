'use client'

import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

// ── Types ───────────────────────────────────────────────────────────────────

interface UsePortalContactArgs {
  token: string
  /** Email to check for returning customer, or null to skip the check. */
  returningEmail: string | null
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Wraps the Convex API calls used by the portal contact step:
 * - `getPortalContext` query (booking metadata + existing customer data)
 * - `savePortalContact` mutation
 * - `checkReturningCustomer` query (dedup by email)
 *
 * Keeps the `convex/` import boundary inside `lib/` so components
 * never import from `convex/` directly.
 */
export function usePortalContact({ token, returningEmail }: UsePortalContactArgs) {
  const context = useQuery(api.customers.getPortalContext, { token })
  const save = useMutation(api.customers.savePortalContact)
  const checkReturning = useQuery(
    api.customers.checkReturningCustomer,
    returningEmail ? { email: returningEmail, token } : 'skip',
  )

  return { context, save, checkReturning }
}
