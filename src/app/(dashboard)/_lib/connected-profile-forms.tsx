'use client'

import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { ReactNode } from 'react'

import { AgentProfileForm, type AgentProfileSection } from '@/components/profiles/agent-profile-form'
import { DiveCenterProfileForm, type DiveCenterProfileSection } from '@/components/profiles/dive-center-profile-form'
import { InstructorProfileForm, type InstructorProfileSection } from '@/components/profiles/instructor-profile-form'
import { DiveMasterProfileForm, type DiveMasterProfileSection } from '@/components/profiles/divemaster-profile-form'
import { BoatProfileForm } from '@/components/profiles/boat-profile-form'
import { CompressorProfileForm } from '@/components/profiles/compressor-profile-form'
import { EquipmentProfileForm } from '@/components/profiles/equipment-profile-form'
import { PoolProfileForm } from '@/components/profiles/pool-profile-form'

import type { RoleKey } from '@/lib/constants/roles'

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
      create={create}
      update={update}
      updateProfile={updateProfile}
    />
  )
}

function ConnectedDiveCenterForm({ section }: { section?: string }) {
  const profile = useQuery(api.diveCenters.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.diveCenters.create)
  const update = useMutation(api.diveCenters.update)
  return (
    <DiveCenterProfileForm
      section={section as DiveCenterProfileSection}
      profile={profile}
      me={me}
      create={create}
      update={update}
    />
  )
}

function ConnectedInstructorForm({ section }: { section?: string }) {
  const profile = useQuery(api.instructors.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.instructors.create)
  const update = useMutation(api.instructors.update)
  return (
    <InstructorProfileForm
      section={section as InstructorProfileSection}
      profile={profile}
      me={me}
      create={create}
      update={update}
    />
  )
}

function ConnectedDiveMasterForm({ section }: { section?: string }) {
  const profile = useQuery(api.diveMasters.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.diveMasters.create)
  const update = useMutation(api.diveMasters.update)
  return (
    <DiveMasterProfileForm
      section={section as DiveMasterProfileSection}
      profile={profile}
      me={me}
      create={create}
      update={update}
    />
  )
}

function ConnectedBoatForm() {
  const profile = useQuery(api.boats.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.boats.create)
  const update = useMutation(api.boats.update)
  return <BoatProfileForm profile={profile} me={me} create={create} update={update} />
}

function ConnectedCompressorForm() {
  const profile = useQuery(api.compressors.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.compressors.create)
  const update = useMutation(api.compressors.update)
  return <CompressorProfileForm profile={profile} me={me} create={create} update={update} />
}

function ConnectedEquipmentForm() {
  const profile = useQuery(api.equipment.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.equipment.create)
  const update = useMutation(api.equipment.update)
  return <EquipmentProfileForm profile={profile} me={me} create={create} update={update} />
}

function ConnectedPoolForm() {
  const profile = useQuery(api.venues.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.venues.create)
  const update = useMutation(api.venues.update)
  return <PoolProfileForm profile={profile} me={me} create={create} update={update} />
}

type RoleProfileRegistryEntry = {
  renderFull: (section: string | undefined) => ReactNode
  embedInSettings?: boolean
}

const ROLE_PROFILE_REGISTRY: Partial<Record<RoleKey, RoleProfileRegistryEntry>> = {
  'dive-center': {
    renderFull: (section) => <ConnectedDiveCenterForm section={section} />,
  },
  agent: {
    renderFull: (section) => <ConnectedAgentForm section={section} />,
  },
  instructor: {
    renderFull: (section) => <ConnectedInstructorForm section={section} />,
  },
  'dive-master': {
    renderFull: (section) => <ConnectedDiveMasterForm section={section} />,
  },
  boat: {
    renderFull: () => <ConnectedBoatForm />,
    embedInSettings: true,
  },
  compressor: {
    renderFull: () => <ConnectedCompressorForm />,
    embedInSettings: true,
  },
  equipment: {
    renderFull: () => <ConnectedEquipmentForm />,
    embedInSettings: true,
  },
  pool: {
    renderFull: () => <ConnectedPoolForm />,
    embedInSettings: true,
  },
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

export function SettingsEmbeddedProfileForm({ roleSlug }: { roleSlug: RoleKey }) {
  const entry = ROLE_PROFILE_REGISTRY[roleSlug]
  if (!entry?.embedInSettings) return null
  return <>{entry.renderFull(undefined)}</>
}
