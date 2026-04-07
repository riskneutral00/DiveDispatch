'use client'

import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { useCurrentUser } from './use-current-user'
import { useWizardPreferences } from './use-wizard-preferences'

export interface OperatorDefaults {
  agency: string
  preferredInstructorSlug: string
  preferredVenueSlug: string
  preferredBoatSlug: string
  preferredEquipmentSlug: string
  preferredCompressorSlug: string
  preferredInstructorSlugs: string[]
  preferredVenueSlugs: string[]
  preferredBoatSlugs: string[]
  preferredEquipmentSlugs: string[]
  preferredCompressorSlugs: string[]
}

const EMPTY_DEFAULTS: OperatorDefaults = {
  agency: '',
  preferredInstructorSlug: '',
  preferredVenueSlug: '',
  preferredBoatSlug: '',
  preferredEquipmentSlug: '',
  preferredCompressorSlug: '',
  preferredInstructorSlugs: [],
  preferredVenueSlugs: [],
  preferredBoatSlugs: [],
  preferredEquipmentSlugs: [],
  preferredCompressorSlugs: [],
}

export function useOperatorDefaults(): { defaults: OperatorDefaults; isLoading: boolean } {
  const { isLoading: userLoading } = useCurrentUser()
  const userRoles = useQuery(api.userRoles.myRoles)
  const roleNames = userRoles?.map((r) => r.role) ?? []
  const hasDC = roleNames.includes('DiveCenter')
  const hasAgent = roleNames.includes('Agent')

  const { prefs, isLoading: prefsLoading } = useWizardPreferences()
  const dcProfile = useQuery(
    api.diveCenters.mine,
    hasDC ? {} : 'skip',
  )
  const agentProfile = useQuery(
    api.agents.mine,
    hasAgent ? {} : 'skip',
  )

  const isLoading = userLoading || userRoles === undefined || prefsLoading ||
    (hasDC && dcProfile === undefined) ||
    (hasAgent && agentProfile === undefined)

  const defaults = useMemo<OperatorDefaults>(() => {
    if (!prefs) return EMPTY_DEFAULTS

    const firstDcAssoc = dcProfile?.associations?.[0]
    const firstAgentAssoc = agentProfile?.associations?.[0]
    const primaryAgency = firstDcAssoc?.agency ?? firstAgentAssoc?.agency ?? ''

    const pi = prefs.preferredInstructorSlugs ?? []
    const pv = prefs.preferredVenueSlugs ?? []
    const pb = prefs.preferredBoatSlugs ?? []
    const pe = prefs.preferredEquipmentSlugs ?? []
    const pc = prefs.preferredCompressorSlugs ?? []

    return {
      agency: primaryAgency,
      preferredInstructorSlugs: pi,
      preferredVenueSlugs: pv,
      preferredBoatSlugs: pb,
      preferredEquipmentSlugs: pe,
      preferredCompressorSlugs: pc,
      preferredInstructorSlug: pi[0] ?? '',
      preferredVenueSlug: pv[0] ?? '',
      preferredBoatSlug: pb[0] ?? '',
      preferredEquipmentSlug: pe[0] ?? '',
      preferredCompressorSlug: pc[0] ?? '',
    }
  }, [prefs, dcProfile?.associations, agentProfile?.associations])

  return { defaults, isLoading }
}
