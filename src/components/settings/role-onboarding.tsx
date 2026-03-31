'use client'

import { useState } from 'react'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { GlassCard, GlassButton } from '@/components/ui'
import { AgentProfileForm } from '@/components/profiles/agent-profile-form'
import { BoatProfileForm } from '@/components/profiles/boat-profile-form'
import { CompressorProfileForm } from '@/components/profiles/compressor-profile-form'
import { OrganizerBasicStep } from '@/components/onboarding/organizer-basic-step'
import { OrganizerAgencyStep } from '@/components/onboarding/organizer-agency-step'
import { OrganizerLanguagesStep } from '@/components/onboarding/organizer-languages-step'
import { DiveMasterProfileForm } from '@/components/profiles/divemaster-profile-form'
import { EquipmentProfileForm } from '@/components/profiles/equipment-profile-form'
import { InstructorProfileForm } from '@/components/profiles/instructor-profile-form'
import { PoolProfileForm } from '@/components/profiles/pool-profile-form'
import { getOrganizerSteps, ORGANIZER_WIZARD_CONFIG, type OrganizerSubStep } from '@/lib/constants/organizer-wizard-config'

function ProfileFormForRole({ role, onComplete }: { role: ClerkRole; onComplete: () => void }) {
  const [organizerSubStep, setOrganizerSubStep] = useState<OrganizerSubStep>('basic')

  // Config-driven organizer wizard
  if (role in ORGANIZER_WIZARD_CONFIG) {
    const steps = getOrganizerSteps(role)

    function goNext() {
      const idx = steps.indexOf(organizerSubStep)
      if (idx < steps.length - 1) {
        setOrganizerSubStep(steps[idx + 1])
      } else {
        onComplete()
      }
    }

    function goBack() {
      const idx = steps.indexOf(organizerSubStep)
      if (idx > 0) {
        setOrganizerSubStep(steps[idx - 1])
      }
      // On first step, do nothing — there's no previous context to return to
    }

    return (
      <>
        {organizerSubStep === 'basic' && (
          <OrganizerBasicStep role={role} onSaved={goNext} onBack={goBack} />
        )}
        {organizerSubStep === 'agency' && (
          <OrganizerAgencyStep role={role} onSaved={goNext} onBack={goBack} />
        )}
        {organizerSubStep === 'languages' && (
          <OrganizerLanguagesStep role={role} onSaved={goNext} onBack={goBack} />
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
