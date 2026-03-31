'use client'

import type { RoleKey } from '@/lib/constants/roles'
import { DiveCenterProfileForm } from '@/components/profiles/dive-center-profile-form'
import { AgentProfileForm } from '@/components/profiles/agent-profile-form'
import { InstructorProfileForm } from '@/components/profiles/instructor-profile-form'
import { DiveMasterProfileForm } from '@/components/profiles/divemaster-profile-form'
import { BoatProfileForm } from '@/components/profiles/boat-profile-form'
import { CompressorProfileForm } from '@/components/profiles/compressor-profile-form'
import { EquipmentProfileForm } from '@/components/profiles/equipment-profile-form'
import { PoolProfileForm } from '@/components/profiles/pool-profile-form'

export function RoleDetailForm({ roleKey }: { roleKey: RoleKey }) {
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
