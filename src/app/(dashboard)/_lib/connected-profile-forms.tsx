'use client'

import { useMutation, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import {
  DiveSiteDetailsSection,
  DiveSiteCapabilitiesSection,
  type DiveSiteProfileSection,
} from '@/components/profiles/dive-site-profile-form'
import {
  DiveCenterContactSection,
  DiveCenterLanguagesSection,
  DiveCenterAffiliationsSection,
  type DiveCenterProfileSection,
} from '@/components/profiles/dive-center-profile-form'
import {
  AgentContactSection,
  AgentLanguagesSection,
  AgentAssociationsSection,
  type AgentProfileSection,
} from '@/components/profiles/agent-profile-form'
import {
  CompressorContactSection,
  CompressorGasMixesSection,
  type CompressorProfileSection,
} from '@/components/profiles/compressor-profile-form'
import {
  EquipmentContactSection,
  EquipmentGearCatalogSection,
  type EquipmentProfileSection,
} from '@/components/profiles/equipment-profile-form'
import {
  PoolContactSection,
  PoolCapabilitiesSection,
  type PoolProfileSection,
} from '@/components/profiles/pool-profile-form'
import {
  BoatContactSection,
  BoatFleetSection,
  type BoatProfileSection,
} from '@/components/profiles/boat-profile-form'
import type { RoleKey } from '@/lib/constants/roles'

/** Convex mutations are strongly typed; profile forms accept `Record<string, unknown>`. */
function asLooseMut<T>(
  fn: (args: T) => Promise<unknown>,
): (payload: Record<string, unknown>) => Promise<unknown> {
  return (p) => fn(p as T)
}

function ConnectedDiveSiteForm({ section }: { section?: string }) {
  const profile = useQuery(api.venues.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.venues.create)
  const update = useMutation(api.venues.update)
  const sectionKey = (section ?? 'details') as DiveSiteProfileSection
  const props = {
    profile,
    me,
    create: asLooseMut(create),
    update: asLooseMut(update),
  }
  if (sectionKey === 'capabilities') return <DiveSiteCapabilitiesSection {...props} />
  return <DiveSiteDetailsSection {...props} />
}

function ConnectedAgentForm({ section }: { section?: string }) {
  const profile = useQuery(api.agents.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.agents.create)
  const update = useMutation(api.agents.update)
  const updateProfile = useMutation(api.users.updateProfile)
  const sectionKey = (section ?? 'contact') as AgentProfileSection
  if (sectionKey === 'languages')
    return (
      <AgentLanguagesSection
        profile={profile}
        me={me}
        update={asLooseMut(update)}
        updateProfile={asLooseMut(updateProfile)}
      />
    )
  if (sectionKey === 'associations')
    return (
      <AgentAssociationsSection
        profile={profile}
        create={asLooseMut(create)}
        update={asLooseMut(update)}
      />
    )
  return (
    <AgentContactSection
      profile={profile}
      me={me}
      create={asLooseMut(create)}
      update={asLooseMut(update)}
    />
  )
}

function ConnectedCompressorForm({ section }: { section?: string }) {
  const profile = useQuery(api.compressors.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.compressors.create)
  const update = useMutation(api.compressors.update)
  const sectionKey = (section ?? 'contact') as CompressorProfileSection
  const props = {
    profile,
    me,
    create: asLooseMut(create),
    update: asLooseMut(update),
  }
  if (sectionKey === 'gas-mixes') return <CompressorGasMixesSection {...props} />
  return <CompressorContactSection {...props} />
}

function ConnectedEquipmentForm({ section }: { section?: string }) {
  const profile = useQuery(api.equipment.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.equipment.create)
  const update = useMutation(api.equipment.update)
  const sectionKey = (section ?? 'contact') as EquipmentProfileSection
  const props = {
    profile,
    me,
    create: asLooseMut(create),
    update: asLooseMut(update),
  }
  if (sectionKey === 'gear-catalog') return <EquipmentGearCatalogSection {...props} />
  return <EquipmentContactSection {...props} />
}

function ConnectedPoolForm({ section }: { section?: string }) {
  const profile = useQuery(api.venues.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.venues.create)
  const update = useMutation(api.venues.update)
  const sectionKey = (section ?? 'contact') as PoolProfileSection
  const props = {
    profile,
    me,
    create: asLooseMut(create),
    update: asLooseMut(update),
  }
  if (sectionKey === 'capabilities') return <PoolCapabilitiesSection {...props} />
  return <PoolContactSection {...props} />
}

function ConnectedBoatForm({ section }: { section?: string }) {
  const profile = useQuery(api.boats.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.boats.create)
  const update = useMutation(api.boats.update)
  const sectionKey = (section ?? 'contact') as BoatProfileSection
  const props = {
    profile,
    me,
    create: asLooseMut(create),
    update: asLooseMut(update),
  }
  if (sectionKey === 'fleet') return <BoatFleetSection {...props} />
  return <BoatContactSection {...props} />
}

function ConnectedDiveCenterForm({ section }: { section?: string }) {
  const profile = useQuery(api.diveCenters.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.diveCenters.create)
  const update = useMutation(api.diveCenters.update)
  const sectionKey = (section ?? 'contact') as DiveCenterProfileSection
  const props = {
    profile,
    me,
    create: asLooseMut(create),
    update: asLooseMut(update),
  }
  if (sectionKey === 'languages') return <DiveCenterLanguagesSection {...props} />
  if (sectionKey === 'associations') return <DiveCenterAffiliationsSection {...props} />
  return <DiveCenterContactSection {...props} />
}

export function RoleProfileForm({
  roleSlug,
  section,
}: {
  roleSlug: RoleKey
  section?: string
}) {
  if (roleSlug === 'dive-site') return <ConnectedDiveSiteForm section={section} />
  if (roleSlug === 'dive-center') return <ConnectedDiveCenterForm section={section} />
  if (roleSlug === 'agent') return <ConnectedAgentForm section={section} />
  if (roleSlug === 'compressor') return <ConnectedCompressorForm section={section} />
  if (roleSlug === 'equipment') return <ConnectedEquipmentForm section={section} />
  if (roleSlug === 'pool') return <ConnectedPoolForm section={section} />
  if (roleSlug === 'boat') return <ConnectedBoatForm section={section} />
  return null
}
