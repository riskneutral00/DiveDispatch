'use client'

import { use, useState } from 'react'
import { notFound } from 'next/navigation'
import { SettingsTabBar } from '@/components/common/settings-tab-bar'
import { PROFILE_REGISTRY } from '@/lib/constants/profile-registry'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'
import { DiveCenterProfileForm, type DiveCenterProfileSection } from '@/components/dashboard/dive-center-profile-form'
import { AgentProfileForm, type AgentProfileSection } from '@/components/dashboard/agent-profile-form'
import { InstructorProfileForm, type InstructorProfileSection } from '@/components/dashboard/instructor-profile-form'
import { DiveMasterProfileForm, type DiveMasterProfileSection } from '@/components/dashboard/divemaster-profile-form'
import { BoatProfileForm } from '@/components/dashboard/boat-profile-form'
import { CompressorProfileForm } from '@/components/dashboard/compressor-profile-form'
import { EquipmentProfileForm } from '@/components/dashboard/equipment-profile-form'
import { PoolProfileForm } from '@/components/dashboard/pool-profile-form'

function ProfileForm({ roleSlug, section }: { roleSlug: RoleKey; section?: string }) {
  switch (roleSlug) {
    case 'dive-center':
      return <DiveCenterProfileForm section={section as DiveCenterProfileSection} />
    case 'agent':
      return <AgentProfileForm section={section as AgentProfileSection} />
    case 'instructor':
      return <InstructorProfileForm section={section as InstructorProfileSection} />
    case 'dive-master':
      return <DiveMasterProfileForm section={section as DiveMasterProfileSection} />
    case 'boat':
      return <BoatProfileForm />
    case 'compressor':
      return <CompressorProfileForm />
    case 'equipment':
      return <EquipmentProfileForm />
    case 'pool':
      return <PoolProfileForm />
    default:
      return null
  }
}

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
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-10">
      <div className="mb-6">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Profile
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {config.label}
        </p>
      </div>

      {config.tabs && (
        <SettingsTabBar tabs={config.tabs} activeTab={activeTab} onChange={setActiveTab} />
      )}

      {config.tabs ? (
        <div
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
        >
          <ProfileForm roleSlug={roleSlug as RoleKey} section={activeTab} />
        </div>
      ) : (
        <ProfileForm roleSlug={roleSlug as RoleKey} />
      )}
    </div>
  )
}
