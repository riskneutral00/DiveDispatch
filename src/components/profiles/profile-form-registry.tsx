import type { ReactNode } from 'react'
import type { RoleKey } from '@/lib/constants/roles'
import { DiveCenterProfileForm, type DiveCenterProfileSection } from '@/components/profiles/dive-center-profile-form'
import { AgentProfileForm, type AgentProfileSection } from '@/components/profiles/agent-profile-form'
import { InstructorProfileForm, type InstructorProfileSection } from '@/components/profiles/instructor-profile-form'
import { DiveMasterProfileForm, type DiveMasterProfileSection } from '@/components/profiles/divemaster-profile-form'
import { BoatProfileForm } from '@/components/profiles/boat-profile-form'
import { CompressorProfileForm } from '@/components/profiles/compressor-profile-form'
import { EquipmentProfileForm } from '@/components/profiles/equipment-profile-form'
import { PoolProfileForm } from '@/components/profiles/pool-profile-form'

/** Full role profile tabbed/single form — used on `/[slug]/[roleSlug]/profile`. */
const FULL_PROFILE_BY_ROLE: {
  [K in RoleKey]?: (section: string | undefined) => ReactNode
} = {
  'dive-center': (section) => (
    <DiveCenterProfileForm section={section as DiveCenterProfileSection} />
  ),
  agent: (section) => <AgentProfileForm section={section as AgentProfileSection} />,
  instructor: (section) => (
    <InstructorProfileForm section={section as InstructorProfileSection} />
  ),
  'dive-master': (section) => (
    <DiveMasterProfileForm section={section as DiveMasterProfileSection} />
  ),
  boat: () => <BoatProfileForm />,
  compressor: () => <CompressorProfileForm />,
  equipment: () => <EquipmentProfileForm />,
  pool: () => <PoolProfileForm />,
}

/** Resource-only forms embedded in settings when `settingsIncludesProfile` — `/[slug]/[roleSlug]/settings`. */
const SETTINGS_EMBEDDED_BY_ROLE: Partial<Record<RoleKey, () => ReactNode>> = {
  boat: () => <BoatProfileForm />,
  compressor: () => <CompressorProfileForm />,
  equipment: () => <EquipmentProfileForm />,
  pool: () => <PoolProfileForm />,
}

export function RoleProfileForm({
  roleSlug,
  section,
}: {
  roleSlug: RoleKey
  section?: string
}) {
  const render = FULL_PROFILE_BY_ROLE[roleSlug]
  return render ? <>{render(section)}</> : null
}

export function SettingsEmbeddedProfileForm({ roleSlug }: { roleSlug: RoleKey }) {
  const render = SETTINGS_EMBEDDED_BY_ROLE[roleSlug]
  return render ? <>{render()}</> : null
}
