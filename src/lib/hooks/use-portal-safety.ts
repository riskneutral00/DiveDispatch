'use client'

import { useMutation, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'

interface UsePortalSafetyArgs {
  token: string
}

export function usePortalSafety({ token }: UsePortalSafetyArgs) {
  const saved = useQuery(api.customerProfiles.getSafetyInfoByToken, { token })
  const save = useMutation(api.customerProfiles.saveSafetyInfo)

  return { saved, save }
}
