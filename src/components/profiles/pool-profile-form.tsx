'use client'

import { BusinessContactSection } from '@/components/profiles/business-contact-section'
import { VenueCapabilitiesSection } from '@/components/profiles/venue-capabilities-section'
import {
  contactSchema,
  poolCapabilitiesSchema,
} from '@/lib/schemas/profile-shared'
import {
  type BaseProfileSectionProps,
} from '@/lib/profile-form'

export type PoolProfileSection = 'contact' | 'capabilities'

type PoolSectionProps = BaseProfileSectionProps

export function buildPoolCreatePayload<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    venueCategory: 'pool' as const,
    hasCompressor: false,
  }
}

export function PoolContactSection({ create, ...props }: PoolSectionProps) {
  return (
    <BusinessContactSection
      {...props}
      create={create}
      createOverride={(payload) => create(buildPoolCreatePayload(payload))}
      nameLabel="Business Name"
      schema={contactSchema}
    />
  )
}

export type PoolCapabilitiesFormState = {
  maxDepth: number
  maxCapacity: number
}

export const INITIAL_POOL_CAPABILITIES_FORM: PoolCapabilitiesFormState = {
  maxDepth: 0,
  maxCapacity: 0,
}

export function poolCapabilitiesFromProfile(p: Record<string, unknown>): PoolCapabilitiesFormState {
  return {
    maxDepth: (p.maxDepth as number) ?? 0,
    maxCapacity: (p.maxCapacity as number) ?? 0,
  }
}

export function poolCapabilitiesToPayload(f: PoolCapabilitiesFormState): Record<string, unknown> {
  return {
    maxDepth: f.maxDepth,
    maxCapacity: f.maxCapacity,
  }
}

export function PoolCapabilitiesSection(props: PoolSectionProps) {
  return (
    <VenueCapabilitiesSection
      {...props}
      schema={poolCapabilitiesSchema}
      defaults={INITIAL_POOL_CAPABILITIES_FORM}
      fromProfile={poolCapabilitiesFromProfile}
      toPayload={poolCapabilitiesToPayload}
      venueType="pool"
      wrapCreatePayload={buildPoolCreatePayload}
      depthPlaceholder="2.5"
      capacityPlaceholder="5"
    />
  )
}

export function PoolProfileForm({
  section,
  profile,
  me,
  create,
  update,
  onSaved,
}: PoolSectionProps & { section?: PoolProfileSection }) {
  if (section === 'capabilities')
    return <PoolCapabilitiesSection profile={profile} me={me} create={create} update={update} />
  return <PoolContactSection profile={profile} me={me} create={create} update={update} onSaved={onSaved} />
}
