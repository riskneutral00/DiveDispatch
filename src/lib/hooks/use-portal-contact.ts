'use client'

import { useMutation, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'

interface UsePortalContactArgs {
  token: string
  returningEmail: string | null
}

export function usePortalContact({ token, returningEmail }: UsePortalContactArgs) {
  const context = useQuery(api.customers.getPortalContext, { token })
  const save = useMutation(api.customers.savePortalContact)
  const checkReturning = useQuery(
    api.customers.checkReturningCustomer,
    returningEmail ? { email: returningEmail, token } : 'skip',
  )

  return { context, save, checkReturning }
}
