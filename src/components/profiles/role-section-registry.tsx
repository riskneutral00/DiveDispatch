import type { ComponentType } from 'react'
import type { BaseProfileSectionProps } from '@/lib/profile-form'
import type { RoleKey, ProfileSectionId } from '@/lib/constants/roles'

import {
  DiveCenterContactSection,
  DiveCenterAffiliationsSection,
} from '@/components/profiles/dive-center-profile-form'
import {
  PersonalContactSection,
  PersonalCredentialsSection,
} from '@/components/profiles/personal-profile-form'
import {
  BoatContactSection,
  BoatFleetSection,
} from '@/components/profiles/boat-profile-form'
import {
  AgentContactSection,
  AgentAssociationsSection,
} from '@/components/profiles/agent-profile-form'
import { CompressorGasMixesSection } from '@/components/profiles/compressor-profile-form'
import { CompressorContactSection } from '@/components/profiles/compressor-contact-section'
import { EquipmentContactSection } from '@/components/profiles/equipment-profile-form'
import { VenueCapabilitiesSection } from '@/components/profiles/venue-capabilities-section'

export type ProfileSectionComponent = ComponentType<BaseProfileSectionProps>

export const ROLE_SECTION_REGISTRY: Record<
  RoleKey,
  Partial<Record<ProfileSectionId, ProfileSectionComponent>>
> = {
  'dive-center': {
    contact: DiveCenterContactSection,
    associations: DiveCenterAffiliationsSection,
  },
  agent: {
    contact: AgentContactSection,
    associations: AgentAssociationsSection,
  },
  instructor: {
    contact: PersonalContactSection,
    credentials: PersonalCredentialsSection,
  },
  boat: {
    contact: BoatContactSection,
    fleet: BoatFleetSection,
  },
  equipment: {
    contact: EquipmentContactSection,
  },
  compressor: {
    contact: CompressorContactSection,
    'gas-mixes': CompressorGasMixesSection,
  },
  venue: {
    capabilities: VenueCapabilitiesSection,
  },
}
