'use client'

import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useCurrentUser } from './use-current-user'

export interface OperatorDefaults {
  agency: string
  preferredInstructorSlug: string
  preferredVenueSlug: string
  preferredBoatSlug: string
  preferredEquipmentSlug: string
  preferredCompressorSlug: string
}

const EMPTY_DEFAULTS: OperatorDefaults = {
  agency: '',
  preferredInstructorSlug: '',
  preferredVenueSlug: '',
  preferredBoatSlug: '',
  preferredEquipmentSlug: '',
  preferredCompressorSlug: '',
}

/**
 * Queries stakeholder preferences + operator profile to derive
 * default values for pre-filling bookings. Loaded once on dashboard mount.
 */
export function useOperatorDefaults(): { defaults: OperatorDefaults; isLoading: boolean } {
  const { isLoading: userLoading } = useCurrentUser()
  const userRoles = useQuery(api.userRoles.myRoles)
  const roleNames = userRoles?.map((r) => r.role) ?? []
  const hasDC = roleNames.includes('DiveCenter')
  const hasAgent = roleNames.includes('Agent')

  const prefs = useQuery(api.stakeholderPreferences.mine)
  const dcProfile = useQuery(
    api.diveCenters.mine,
    hasDC ? {} : 'skip',
  )
  const agentProfile = useQuery(
    api.agents.mine,
    hasAgent ? {} : 'skip',
  )

  const isLoading = userLoading || userRoles === undefined || prefs === undefined ||
    (hasDC && dcProfile === undefined) ||
    (hasAgent && agentProfile === undefined)

  const defaults = useMemo<OperatorDefaults>(() => {
    if (!prefs) return EMPTY_DEFAULTS

    // Derive primary agency from operator profile associations
    const firstDcAssoc = dcProfile?.associations?.[0]
    const firstAgentAssoc = agentProfile?.associations?.[0]
    const primaryAgency = firstDcAssoc?.agency ?? firstAgentAssoc?.agency ?? ''

    return {
      agency: primaryAgency,
      preferredInstructorSlug: prefs.preferredInstructorSlugs?.[0] ?? '',
      preferredVenueSlug: prefs.preferredVenueSlugs?.[0] ?? '',
      preferredBoatSlug: prefs.preferredBoatSlugs?.[0] ?? '',
      preferredEquipmentSlug: prefs.preferredEquipmentSlugs?.[0] ?? '',
      preferredCompressorSlug: prefs.preferredCompressorSlugs?.[0] ?? '',
    }
  }, [prefs, dcProfile?.associations, agentProfile?.associations])

  return { defaults, isLoading }
}
