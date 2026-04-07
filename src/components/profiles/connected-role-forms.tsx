'use client'

import { type ComponentType } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'

import { AgentProfileForm, type AgentProfileSection } from '@/components/profiles/agent-profile-form'
import { DiveCenterProfileForm } from '@/components/profiles/dive-center-profile-form'
import { InstructorProfileForm } from '@/components/profiles/personal-profile-form'
import { DiveMasterProfileForm } from '@/components/profiles/personal-profile-form'
import { BoatProfileForm } from '@/components/profiles/boat-profile-form'
import { CompressorProfileForm } from '@/components/profiles/compressor-profile-form'
import { EquipmentProfileForm } from '@/components/profiles/equipment-profile-form'
import { PoolProfileForm } from '@/components/profiles/pool-profile-form'
import { DiveSiteProfileForm } from '@/components/profiles/dive-site-profile-form'

import type { RoleKey } from '@/lib/constants/roles'

function asLooseMut<T>(
  fn: (args: T) => Promise<unknown>,
): (payload: Record<string, unknown>) => Promise<unknown> {
  return (p) => fn(p as T)
}

interface RoleFormConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex FunctionReference generics are opaque at this abstraction level
  apiModule: { mine: any; create: any; update: any }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Profile form prop shapes vary per role; type safety is at the form level
  Component: ComponentType<any>
}

const ROLE_FORM_CONFIGS: Partial<Record<RoleKey, RoleFormConfig>> = {
  'dive-center': { apiModule: api.diveCenters, Component: DiveCenterProfileForm },
  instructor:    { apiModule: api.instructors,  Component: InstructorProfileForm },
  'dive-master': { apiModule: api.diveMasters,  Component: DiveMasterProfileForm },
  boat:          { apiModule: api.boats,        Component: BoatProfileForm },
  compressor:    { apiModule: api.compressors,  Component: CompressorProfileForm },
  equipment:     { apiModule: api.equipment,    Component: EquipmentProfileForm },
  pool:          { apiModule: api.venues,       Component: PoolProfileForm },
  'dive-site':   { apiModule: api.venues,       Component: DiveSiteProfileForm },
}

function StandardConnectedForm({ section, config }: { section?: string; config: RoleFormConfig }) {
  const { apiModule, Component } = config
  const profile = useQuery(apiModule.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(apiModule.create)
  const update = useMutation(apiModule.update)
  return (
    <Component
      section={section}
      profile={profile}
      me={me}
      create={asLooseMut(create)}
      update={asLooseMut(update)}
    />
  )
}

function ConnectedAgentForm({ section }: { section?: string }) {
  const profile = useQuery(api.agents.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.agents.create)
  const update = useMutation(api.agents.update)
  const updateProfile = useMutation(api.users.updateProfile)
  return (
    <AgentProfileForm
      section={section as AgentProfileSection}
      profile={profile}
      me={me}
      create={asLooseMut(create)}
      update={asLooseMut(update)}
      updateProfile={asLooseMut(updateProfile)}
    />
  )
}

type RoleProfileRegistryEntry = {
  renderFull: (section: string | undefined) => React.ReactNode
}

const ROLE_PROFILE_REGISTRY: Partial<Record<RoleKey, RoleProfileRegistryEntry>> = {
  agent: { renderFull: (section) => <ConnectedAgentForm section={section} /> },

  ...Object.fromEntries(
    Object.entries(ROLE_FORM_CONFIGS).map(([key, config]) => [
      key,
      {
        renderFull: (section: string | undefined) => (
          <StandardConnectedForm section={section} config={config} />
        ),
      },
    ]),
  ),
}

export function hasConnectedForm(roleKey: RoleKey): boolean {
  return roleKey in ROLE_PROFILE_REGISTRY
}

export function RoleProfileForm({
  roleSlug,
  section,
}: {
  roleSlug: RoleKey
  section?: string
}) {
  const entry = ROLE_PROFILE_REGISTRY[roleSlug]
  return entry ? <>{entry.renderFull(section)}</> : null
}
