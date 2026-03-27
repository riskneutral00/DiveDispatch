'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { SettingsTabBar } from '@/components/common/settings-tab-bar'
import { DiveCenterProfileForm } from '@/components/dashboard/dive-center-profile-form'
import { AgentProfileForm } from '@/components/dashboard/agent-profile-form'
import { InstructorProfileForm } from '@/components/dashboard/instructor-profile-form'
import { DiveMasterProfileForm } from '@/components/dashboard/divemaster-profile-form'
import { BoatProfileForm } from '@/components/dashboard/boat-profile-form'
import { CompressorProfileForm } from '@/components/dashboard/compressor-profile-form'
import { EquipmentProfileForm } from '@/components/dashboard/equipment-profile-form'
import { PoolProfileForm } from '@/components/dashboard/pool-profile-form'
import { PreferencesEditor } from '@/components/dashboard/preferences-editor'

function RoleDetailForm({ roleKey }: { roleKey: RoleKey }) {
  switch (roleKey) {
    case 'dive-center':
      return <DiveCenterProfileForm />
    case 'agent':
      return <AgentProfileForm />
    case 'instructor':
      return <InstructorProfileForm />
    case 'dive-master':
      return <DiveMasterProfileForm />
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

export function RolesTab() {
  const userRoles = useQuery(api.userRoles.myRoles)
  const [activeRoleKey, setActiveRoleKey] = useState<string | null>(null)

  if (userRoles === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm animate-pulse" style={{ color: 'var(--color-text-secondary)' }}>
          Loading roles…
        </span>
      </div>
    )
  }

  const roleConfigs = userRoles
    .map((r) => ROLE_BY_CLERK_ROLE[r.role as ClerkRole])
    .filter(Boolean)

  if (roleConfigs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            Roles
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No roles configured yet.
          </p>
        </div>
      </div>
    )
  }

  const currentKey = activeRoleKey ?? roleConfigs[0].key
  const tabs = roleConfigs.map((r) => ({ id: r.key, label: r.label }))

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Roles
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Settings specific to each of your roles.
        </p>
      </div>

      <SettingsTabBar
        tabs={tabs}
        activeTab={currentKey}
        onChange={setActiveRoleKey}
      />

      <RoleDetailForm roleKey={currentKey as RoleKey} />

      <hr className="form-divider" />

      <PreferencesEditor />
    </div>
  )
}
