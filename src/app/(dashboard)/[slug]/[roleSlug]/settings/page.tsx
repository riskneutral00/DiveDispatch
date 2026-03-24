'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { PreferencesEditor } from '@/components/dashboard/preferences-editor'
import { PROFILE_REGISTRY } from '@/lib/constants/profile-registry'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'
import { BoatProfileForm } from '@/components/dashboard/boat-profile-form'
import { CompressorProfileForm } from '@/components/dashboard/compressor-profile-form'
import { EquipmentProfileForm } from '@/components/dashboard/equipment-profile-form'
import { PoolProfileForm } from '@/components/dashboard/pool-profile-form'

function SettingsProfileForm({ roleSlug }: { roleSlug: RoleKey }) {
  switch (roleSlug) {
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
      {config?.settingsIncludesProfile && (
        <SettingsProfileForm roleSlug={roleSlug as RoleKey} />
      )}
      <PreferencesEditor />
    </>
  )
}
