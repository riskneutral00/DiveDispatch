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
  const { user, isLoading: userLoading } = useCurrentUser()
  const role = user?.role

  const prefs = useQuery(api.stakeholderPreferences.mine)
  const dcProfile = useQuery(
    api.diveCenters.mine,
    role === 'DiveCenter' ? {} : 'skip',
  )
  const agentProfile = useQuery(
    api.agents.mine,
    role === 'Agent' ? {} : 'skip',
  )

  const isLoading = userLoading || prefs === undefined ||
    (role === 'DiveCenter' && dcProfile === undefined) ||
    (role === 'Agent' && agentProfile === undefined)

  const defaults = useMemo<OperatorDefaults>(() => {
    if (!prefs) return EMPTY_DEFAULTS

    // Derive primary agency from operator profile associations
    const associations = dcProfile?.associations ?? agentProfile?.associations ?? []
    const primaryAgency = associations[0]?.agency ?? ''

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
