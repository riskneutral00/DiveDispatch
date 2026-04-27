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

interface RoleApiBinding {
  apiModule: RoleApiModule
  entityIdKey: 'entityId' | 'venueId' | 'compressorId' | null
}

const ROLE_API_BINDINGS: Partial<Record<RoleKey, RoleApiBinding>> = {
  'dive-center': { apiModule: api.diveCenters, entityIdKey: 'entityId' },
  instructor:    { apiModule: api.diveStaff,   entityIdKey: null },
  boat:          { apiModule: api.boats,       entityIdKey: 'entityId' },
  compressor:    { apiModule: api.compressors, entityIdKey: 'compressorId' },
  equipment:     { apiModule: api.equipment,   entityIdKey: 'entityId' },
  venue:         { apiModule: api.venues,      entityIdKey: 'venueId' },
  agent:         { apiModule: api.agents,      entityIdKey: null },
}

function pickEditableRow(
  raw: unknown,
): { row: Record<string, unknown> | null; loading: boolean } {
  if (raw === undefined) return { row: null, loading: true }
  if (raw === null) return { row: null, loading: false }
  if (Array.isArray(raw)) {
    return { row: (raw[0] as Record<string, unknown> | undefined) ?? null, loading: false }
  }
  return { row: raw as Record<string, unknown>, loading: false }
}

function StandardConnectedForm({
  binding,
  Section,
  onClose,
}: {
  binding: RoleApiBinding
  Section: ProfileSectionComponent
  onClose?: () => void
}) {
  const raw = useQuery(binding.apiModule.mine)
  const { user: me } = useSessionIdentity()
  const create = useMutation(binding.apiModule.create)
  const update = useMutation(binding.apiModule.update)

  const { row, loading } = pickEditableRow(raw)
  const idKey = binding.entityIdKey

  const looseUpdate = asLooseMut(update)
  const wrappedUpdate = idKey
    ? (payload: Record<string, unknown>) => {
        const id = row?._id
        if (!id) {
          return Promise.reject(new Error(`Cannot update before row exists for ${idKey}`))
        }
        return looseUpdate({ [idKey]: id, ...payload })
      }
    : looseUpdate

  return (
    <Section
      profile={loading ? undefined : row}
      me={me}
      create={asLooseMut(create)}
      update={wrappedUpdate}
      onClose={onClose}
    />
  )
}

export function hasConnectedForm(roleKey: RoleKey): boolean {
  return roleKey in ROLE_SECTION_REGISTRY && roleKey in ROLE_API_BINDINGS
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
  const binding = ROLE_API_BINDINGS[roleSlug]
  const sections = ROLE_SECTION_REGISTRY[roleSlug]
  if (!binding || !sections) return null

  const sectionKey = (section ?? Object.keys(sections)[0]) as ProfileSectionId
  const Section = sections[sectionKey]
  if (!Section) return null

  return (
    <StandardConnectedForm
      binding={binding}
      Section={Section}
      onClose={onClose}
    />
  )
}
