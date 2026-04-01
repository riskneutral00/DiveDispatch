'use client'

import { use, useState } from 'react'
import { notFound } from 'next/navigation'
import { DashboardPageFrame } from '@/components/layout/dashboard-page-frame'
import { SettingsTabBar } from '@/components/settings/settings-tab-bar'
import { PROFILE_REGISTRY } from '@/lib/constants/profile-registry'
import { RoleProfileForm } from '@/app/(dashboard)/_lib/connected-profile-forms'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'

export default function RoleProfilePage({
  params,
}: {
  params: Promise<{ slug: string; roleSlug: string }>
}) {
  const { roleSlug } = use(params)

  if (!ROLE_BY_KEY[roleSlug as RoleKey]) notFound()

  const config = PROFILE_REGISTRY[roleSlug]
  if (!config) notFound()

  const [activeTab, setActiveTab] = useState(config.tabs?.[0]?.id ?? '')

  return (
    <DashboardPageFrame
      maxWidth="3xl"
      padding="mobileNavClearance"
      title="Profile"
      description={config.label}
    >
      {config.tabs && (
        <SettingsTabBar tabs={config.tabs} activeTab={activeTab} onChange={setActiveTab} />
      )}

      {config.tabs ? (
        <div
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
        >
          <RoleProfileForm roleSlug={roleSlug as RoleKey} section={activeTab} />
        </div>
      ) : (
        <RoleProfileForm roleSlug={roleSlug as RoleKey} />
      )}
    </DashboardPageFrame>
  )
}
