import type { ComponentType } from 'react'
import type { BaseProfileSectionProps } from '@/lib/profile-form'
import type { RoleKey, ProfileSectionId } from '@/lib/constants/roles'

import {
  DiveCenterAffiliationsSection,
} from '@/components/profiles/dive-center-profile-form'
import {
  PersonalCredentialsSection,
} from '@/components/profiles/personal-profile-form'
import {
  BoatFleetSection,
} from '@/components/profiles/boat-profile-form'
import {
  AgentContactSection,
  AgentAssociationsSection,
} from '@/components/profiles/agent-profile-form'
import { CompressorGasMixesSection } from '@/components/profiles/compressor-profile-form'
import { VenueCapabilitiesSection } from '@/components/profiles/venue-capabilities-section'

export type ProfileSectionComponent = ComponentType<BaseProfileSectionProps>

export const ROLE_SECTION_REGISTRY: Record<
  RoleKey,
  Partial<Record<ProfileSectionId, ProfileSectionComponent>>
> = {
  'dive-center': {
    associations: DiveCenterAffiliationsSection,
  },
  agent: {
    contact: AgentContactSection,
    associations: AgentAssociationsSection,
  },
  instructor: {
    credentials: PersonalCredentialsSection,
  },
  boat: {
    fleet: BoatFleetSection,
  },
  equipment: {},
  compressor: {
    'gas-mixes': CompressorGasMixesSection,
  },
  venue: {
    capabilities: VenueCapabilitiesSection,
  },
}
