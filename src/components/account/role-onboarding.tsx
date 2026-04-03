'use client'

import { useState } from 'react'
import { GlassCard, GlassButton } from '@/components/ui'
import { OrganizerBasicStep } from '@/components/onboarding/organizer-basic-step'
import { OrganizerAgencyStep } from '@/components/onboarding/organizer-agency-step'
import { OrganizerLanguagesStep } from '@/components/onboarding/organizer-languages-step'
import { getOrganizerSteps, ORGANIZER_WIZARD_CONFIG, type OrganizerSubStep } from '@/lib/constants/organizer-wizard-config'
import { RoleProfileForm } from '@/lib/profile/connected-role-forms'
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from '@/lib/constants/roles'

const ROLE_KEYS_WITH_CONNECTED_FORM: readonly RoleKey[] = [
  'dive-center',
  'agent',
  'instructor',
  'dive-master',
  'boat',
  'compressor',
  'equipment',
  'pool',
]

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

  const cfg = ROLE_BY_CLERK_ROLE[role]
  const key = cfg?.key
  if (key && ROLE_KEYS_WITH_CONNECTED_FORM.includes(key)) {
    return <RoleProfileForm roleSlug={key} />
  }

  return (
    <GlassCard padding="md">
      <p className="text-secondary" style={{ fontSize: 14, textAlign: 'center' }}>
        Profile setup for <strong>{cfg?.label ?? role}</strong> is available from your dashboard.
      </p>
    </GlassCard>
  )
}

interface RoleOnboardingProps {
  role: ClerkRole
  onComplete: () => void
}

/**
 * Mini-onboarding flow shown after adding a new role from Workspace.
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
          Complete your profile details for this role. You can always finish later from your Roles tab.
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
