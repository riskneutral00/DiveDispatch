'use client'

import { useMutation, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { useSessionIdentity } from '@/lib/hooks/use-session-identity'

import {
  ROLE_SECTION_REGISTRY,
  type ProfileSectionComponent,
} from '@/components/profiles/role-section-registry'

import type { RoleKey, ProfileSectionId } from '@/lib/constants/roles'

function asLooseMut<T>(
  fn: (args: T) => Promise<unknown>,
): (payload: Record<string, unknown>) => Promise<unknown> {
  return (p) => fn(p as T)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex FunctionReference generics are opaque at this abstraction level // comments-ok
type RoleApiModule = { mine: any; create: any; update: any }

const ROLE_API_MODULES: Partial<Record<RoleKey, RoleApiModule>> = {
  'dive-center': api.diveCenters,
  instructor:    api.diveStaff,
  boat:          api.boats,
  compressor:    api.compressors,
  equipment:     api.equipment,
  venue:         api.venues,
  agent:         api.agents,
}

function StandardConnectedForm({
  apiModule,
  Section,
  onClose,
}: {
  apiModule: RoleApiModule
  Section: ProfileSectionComponent
  onClose?: () => void
}) {
  const profile = useQuery(apiModule.mine)
  const { user: me } = useSessionIdentity()
  const create = useMutation(apiModule.create)
  const update = useMutation(apiModule.update)
  return (
    <Section
      profile={profile}
      me={me}
      create={asLooseMut(create)}
      update={asLooseMut(update)}
      onClose={onClose}
    />
  )
}

export function hasConnectedForm(roleKey: RoleKey): boolean {
  return roleKey in ROLE_SECTION_REGISTRY && roleKey in ROLE_API_MODULES
}

export function RoleProfileForm({
  roleSlug,
  section,
  onClose,
}: {
  roleSlug: RoleKey
  section?: string
  onClose?: () => void
}) {
  const apiModule = ROLE_API_MODULES[roleSlug]
  const sections = ROLE_SECTION_REGISTRY[roleSlug]
  if (!apiModule || !sections) return null

  const sectionKey = (section ?? Object.keys(sections)[0]) as ProfileSectionId
  const Section = sections[sectionKey]
  if (!Section) return null

  return (
    <StandardConnectedForm
      apiModule={apiModule}
      Section={Section}
      onClose={onClose}
    />
  )
}
