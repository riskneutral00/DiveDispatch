'use client'

import { useMutation, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'

interface UsePortalMedicalArgs {
  token: string
}

export function usePortalMedical({ token }: UsePortalMedicalArgs) {
  const saved = useQuery(api.customerProfiles.getMedicalByToken, { token })
  const save = useMutation(api.customerProfiles.saveMedicalAnswers)

  return { saved, save }
}
