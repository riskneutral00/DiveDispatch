'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { DashboardPageFrame } from '@/components/layout/dashboard-page-frame'
import { PreferencesEditor } from '@/components/settings/preferences-editor'
import { PROFILE_REGISTRY } from '@/lib/constants/profile-registry'
import { SettingsEmbeddedProfileForm } from '@/app/(dashboard)/_lib/connected-profile-forms'
import { ConnectedEquipmentInventory } from '@/app/(dashboard)/_lib/connected-inventory'
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
  if (!config) notFound()

  const isEquipment = roleSlug === 'equipment'

  return (
    <DashboardPageFrame
      maxWidth="3xl"
      padding="none"
      title="Settings"
      description={config.label}
    >
      <ManageRolesConnected />
      {config.settingsIncludesProfile && (
        <SettingsEmbeddedProfileForm roleSlug={roleSlug as RoleKey} />
      )}
      {isEquipment && <ConnectedEquipmentInventory />}
      <PreferencesEditor />
    </DashboardPageFrame>
  )
}
