'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { PreferencesEditor } from '@/components/dashboard/preferences-editor'
import { PROFILE_REGISTRY } from '@/lib/constants/profile-registry'
import { SettingsEmbeddedProfileForm } from '@/components/dashboard/profile-form-registry'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'
import { ManageRolesConnected } from '@/components/settings/manage-roles-connected'

export default function RoleSettingsPage({
  params,
}: {
  params: Promise<{ slug: string; roleSlug: string }>
}) {
  const { roleSlug } = use(params)

  if (!ROLE_BY_KEY[roleSlug as RoleKey]) notFound()

  const config = PROFILE_REGISTRY[roleSlug]

  return (
    <>
      <ManageRolesConnected />
      {config?.settingsIncludesProfile && (
        <SettingsEmbeddedProfileForm roleSlug={roleSlug as RoleKey} />
      )}
      <PreferencesEditor />
    </>
  )
}
