'use client'

import { useMutation, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import type { RoleKey } from '@/lib/constants/roles'
import {
  RoleProfileForm as LibRoleProfileForm,
  WorkspaceEmbeddedProfileForm as LibWorkspaceEmbeddedProfileForm,
} from '@/lib/profile/connected-role-forms'
import { DiveSiteProfileForm } from '@/components/profiles/dive-site-profile-form'

/** Convex mutations are strongly typed; profile forms accept `Record<string, unknown>`. */
function asLooseMut<T>(
  fn: (args: T) => Promise<unknown>,
): (payload: Record<string, unknown>) => Promise<unknown> {
  return (p) => fn(p as T)
}

function ConnectedDiveSiteForm() {
  const profile = useQuery(api.venues.mine)
  const me = useQuery(api.users.me)
  const create = useMutation(api.venues.create)
  const update = useMutation(api.venues.update)
  return (
    <DiveSiteProfileForm
      profile={profile}
      me={me}
      create={asLooseMut(create)}
      update={asLooseMut(update)}
    />
  )
}

export function RoleProfileForm({
  roleSlug,
  section,
}: {
  roleSlug: RoleKey
  section?: string
}) {
  if (roleSlug === 'dive-site') return <ConnectedDiveSiteForm />
  return <LibRoleProfileForm roleSlug={roleSlug} section={section} />
}

export function WorkspaceEmbeddedProfileForm({ roleSlug }: { roleSlug: RoleKey }) {
  return <LibWorkspaceEmbeddedProfileForm roleSlug={roleSlug} />
}
