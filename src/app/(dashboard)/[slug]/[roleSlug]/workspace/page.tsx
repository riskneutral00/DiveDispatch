'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { DashboardPageFrame } from '@/components/layout/dashboard-page-frame'
import { PreferencesEditor } from '@/components/account/preferences-editor'
import { PROFILE_REGISTRY } from '@/lib/constants/profile-registry'
import { WorkspaceEmbeddedProfileForm } from '@/app/(dashboard)/_lib/connected-profile-forms'
import { ConnectedEquipmentInventory } from '@/app/(dashboard)/_lib/connected-inventory'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'
import { ManageRolesConnected } from '@/components/account/manage-roles-connected'

export default function RoleWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string; roleSlug: string }>
}) {
  const { roleSlug } = use(params)
  const tNav = useTranslations('nav')

  if (!ROLE_BY_KEY[roleSlug as RoleKey]) notFound()

  const config = PROFILE_REGISTRY[roleSlug]
  if (!config) notFound()

  const isEquipment = roleSlug === 'equipment'

  return (
    <DashboardPageFrame
      maxWidth="3xl"
      padding="none"
      title={tNav('workspace')}
      description={config.label}
    >
      <ManageRolesConnected />
      {config.workspaceIncludesEmbeddedProfile && (
        <WorkspaceEmbeddedProfileForm roleSlug={roleSlug as RoleKey} />
      )}
      {isEquipment && <ConnectedEquipmentInventory />}
      <PreferencesEditor />
    </DashboardPageFrame>
  )
}
