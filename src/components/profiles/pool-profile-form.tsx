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

// ── Types ────────────────────────────────────────────────────────────

export type PoolProfileSection = 'contact' | 'capabilities'

type PoolSectionProps = BaseProfileSectionProps

// ── Contact section ──────────────────────────────────────────────────


export function buildPoolCreatePayload<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    venueType: 'Pool' as const,
    isPublic: false,
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
      namePlaceholder="Blue Lagoon Training Pool"
      schema={contactSchema}
    />
  )
}

// ── Capabilities section ─────────────────────────────────────────────

export type PoolCapabilitiesFormState = {
  confinedCapable: boolean
  maxDepth: number
  maxCapacity: number
}

export const INITIAL_POOL_CAPABILITIES_FORM: PoolCapabilitiesFormState = {
  confinedCapable: false,
  maxDepth: 0,
  maxCapacity: 0,
}

export function poolCapabilitiesFromProfile(p: Record<string, unknown>): PoolCapabilitiesFormState {
  return {
    confinedCapable: (p.confinedCapable as boolean) ?? false,
    maxDepth: (p.maxDepth as number) ?? 0,
    maxCapacity: (p.maxCapacity as number) ?? 0,
  }
}

export function poolCapabilitiesToPayload(f: PoolCapabilitiesFormState): Record<string, unknown> {
  return {
    confinedCapable: f.confinedCapable,
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
      depthPlaceholder="5"
      capacityPlaceholder="15"
    />
  )
}

// ── Compat alias ─────────────────────────────────────────────────────

/**
 * Dispatches to the appropriate section component based on the `section` prop.
 * The app-layer ConnectedPoolForm short-circuits before this is reached
 * at runtime; this export exists so that the lib-layer registry in
 * connected-role-forms.tsx continues to type-check without modification.
 */
export function PoolProfileForm({
  section,
  profile,
  me,
  create,
  update,
  onSaved,
}: PoolSectionProps & { section?: PoolProfileSection }) {
  if (section === 'capabilities')
    return <PoolCapabilitiesSection profile={profile} create={create} update={update} />
  return <PoolContactSection profile={profile} me={me} create={create} update={update} onSaved={onSaved} />
}

