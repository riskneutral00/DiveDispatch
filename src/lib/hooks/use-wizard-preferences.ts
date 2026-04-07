'use client'

import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
type PrefsDoc = {
  preferredOperatorSlug?: string
  preferredInstructorSlugs?: string[]
  preferredVenueSlugs?: string[]
  preferredBoatSlugs?: string[]
  preferredEquipmentSlugs?: string[]
  preferredCompressorSlugs?: string[]
  acceptanceMode?: string
  [key: string]: unknown
} | null | undefined

export function useWizardPreferences(referralOwnerSlug?: string | null): {
  prefs: PrefsDoc
  isLoading: boolean
} {
  const userRoles = useQuery(api.userRoles.myRoles)
  const roleNames = userRoles?.map((r) => r.role) ?? []
  const hasAgent = roleNames.includes('Agent')

  const minePrefs = useQuery(api.stakeholderPreferences.mine)

  const fromReferral = useQuery(
    api.stakeholderPreferences.bySlug,
    referralOwnerSlug ? { stakeholderSlug: referralOwnerSlug } : 'skip',
  )

  const fromPreferredOperator = useQuery(
    api.stakeholderPreferences.bySlug,
    !referralOwnerSlug && hasAgent && minePrefs?.preferredOperatorSlug
      ? { stakeholderSlug: minePrefs.preferredOperatorSlug }
      : 'skip',
  )

  const { prefs, isLoading } = useMemo(() => {
    if (userRoles === undefined || minePrefs === undefined) {
      return { prefs: undefined, isLoading: true }
    }

    if (referralOwnerSlug) {
      if (fromReferral === undefined) return { prefs: undefined, isLoading: true }
      return { prefs: (fromReferral ?? minePrefs) as PrefsDoc, isLoading: false }
    }

    if (hasAgent && minePrefs?.preferredOperatorSlug) {
      if (fromPreferredOperator === undefined) return { prefs: undefined, isLoading: true }
      return { prefs: (fromPreferredOperator ?? minePrefs) as PrefsDoc, isLoading: false }
    }

    return { prefs: minePrefs as PrefsDoc, isLoading: false }
  }, [
    userRoles,
    minePrefs,
    referralOwnerSlug,
    fromReferral,
    fromPreferredOperator,
    hasAgent,
  ])

  return { prefs, isLoading }
}
