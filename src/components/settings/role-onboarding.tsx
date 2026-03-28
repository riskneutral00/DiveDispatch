'use client'

import { useState } from 'react'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { GlassCard, GlassButton } from '@/components/glass'
import { AgentProfileForm } from '@/components/dashboard/agent-profile-form'
import { BoatProfileForm } from '@/components/dashboard/boat-profile-form'
import { CompressorProfileForm } from '@/components/dashboard/compressor-profile-form'
import { DcBasicStep } from '@/components/dashboard/dc-basic-step'
import { DcAgencyStep } from '@/components/dashboard/dc-agency-step'
import { DcLanguagesStep } from '@/components/dashboard/dc-languages-step'
import { DiveMasterProfileForm } from '@/components/dashboard/divemaster-profile-form'
import { EquipmentProfileForm } from '@/components/dashboard/equipment-profile-form'
import { InstructorProfileForm } from '@/components/dashboard/instructor-profile-form'
import { PoolProfileForm } from '@/components/dashboard/pool-profile-form'

type DcSubStep = 'dc-basic' | 'dc-agency' | 'dc-languages'

function ProfileFormForRole({ role, onComplete }: { role: ClerkRole; onComplete: () => void }) {
  const [dcSubStep, setDcSubStep] = useState<DcSubStep>('dc-basic')

  if (role === 'DiveCenter') {
    return (
      <>
        {dcSubStep === 'dc-basic' && (
          <DcBasicStep onSaved={() => setDcSubStep('dc-agency')} onBack={() => onComplete()} />
        )}
        {dcSubStep === 'dc-agency' && (
          <DcAgencyStep onSaved={() => setDcSubStep('dc-languages')} onBack={() => setDcSubStep('dc-basic')} />
        )}
        {dcSubStep === 'dc-languages' && (
          <DcLanguagesStep onSaved={onComplete} onBack={() => setDcSubStep('dc-agency')} />
        )}
      </>
    )
  }

  switch (role) {
    case 'Agent':       return <AgentProfileForm />
    case 'Instructor':  return <InstructorProfileForm />
    case 'DiveMaster':  return <DiveMasterProfileForm />
    case 'Boat':        return <BoatProfileForm />
    case 'Equipment':   return <EquipmentProfileForm />
    case 'Pool':        return <PoolProfileForm />
    case 'Compressor':  return <CompressorProfileForm />
    default: {
      const config = ROLE_BY_CLERK_ROLE[role]
      return (
        <GlassCard padding="md">
          <p className="text-secondary" style={{ fontSize: 14, textAlign: 'center' }}>
            Profile setup for <strong>{config?.label ?? role}</strong> is available from your dashboard.
          </p>
        </GlassCard>
      )
    }
  }
}

interface RoleOnboardingProps {
  role: ClerkRole
  onComplete: () => void
}

/**
 * Mini-onboarding flow shown after adding a new role from settings.
 * Renders the profile form for the given role with a header and done action.
 */
export function RoleOnboarding({ role, onComplete }: RoleOnboardingProps) {
  const config = ROLE_BY_CLERK_ROLE[role]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 className="text-primary"
          style={{ fontSize: 18,
            fontWeight: 600,
            margin: 0,
            marginBottom: 4 }}
        >
          Set up your {config?.label ?? role} profile
        </h2>
        <p className="text-secondary" style={{ fontSize: 13, margin: 0 }}>
          Complete your profile details for this role. You can always finish later from settings.
        </p>
      </div>

      <ProfileFormForRole role={role} onComplete={onComplete} />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <GlassButton variant="secondary" onClick={onComplete}>
          Done
        </GlassButton>
      </div>
    </div>
  )
}
