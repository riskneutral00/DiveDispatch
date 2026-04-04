'use client'

import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { api } from '@/lib/convex-generated'
import { Button, Card } from '@/components/ui'
import { parseConvexError } from '@/lib/utils/convex-error'
import { ROLE_BY_CLERK_ROLE, ROLES, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { ROLE_PRECEDENCE } from '@/lib/utils/role'
import type { Language } from '@/lib/types/language'
import { Spinner } from '@/components/ui/spinner'
import { StepIndicator } from '@/components/onboarding/step-indicator'
import { StepBusinessInfo, type BusinessInfoValues } from './step-business-info'
import { buildOnboardingSteps, roleLabelForClerkRole } from './onboarding-steps'
import { OrganizerBasicStep } from '@/components/onboarding/organizer-basic-step'
import { OrganizerAgencyStep } from '@/components/onboarding/organizer-agency-step'
import { OrganizerLanguagesStep } from '@/components/onboarding/organizer-languages-step'
import { StepPreferences } from './step-preferences'
import { getOrganizerSteps, ORGANIZER_WIZARD_CONFIG, type OrganizerSubStep } from '@/lib/constants/organizer-wizard-config'
import { RoleProfileForm, hasConnectedForm } from '@/components/profiles/connected-role-forms'

function ProfileFormForRole({ role }: { role: string; onSaved: () => void }) {
  const cfg = ROLE_BY_CLERK_ROLE[role as ClerkRole]
  const key = cfg?.key
  if (key && hasConnectedForm(key)) {
    return <RoleProfileForm roleSlug={key} />
  }
  return (
    <Card padding="md">
      <p className="text-secondary" style={{ fontSize: 14, textAlign: 'center' }}>
        Profile setup for <strong>{role}</strong> is available from your dashboard settings.
      </p>
    </Card>
  )
}

export function OnboardingWizard() {
  const user = useQuery(api.users.me)
  const userRoles = useQuery(api.userRoles.myRoles)
  const onboardingStatus = useQuery(api.users.getOnboardingStatus)
  const updateBusinessInfo = useMutation(api.users.updateBusinessInfo)
  const completeOnboarding = useMutation(api.users.completeOnboarding)
  const router = useRouter()

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [organizerSubStep, setOrganizerSubStep] = useState<OrganizerSubStep>('basic')
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [businessInfo, setBusinessInfo] = useState<BusinessInfoValues>({
    businessName: '',
    customerLanguages: [],
  })

  // Derive the role names from userRoles sorted by precedence
  const roleNames = useMemo(() => {
    if (userRoles && userRoles.length > 0) {
      const sorted = [...userRoles].sort(
        (a, b) => (ROLE_PRECEDENCE[a.role] ?? Infinity) - (ROLE_PRECEDENCE[b.role] ?? Infinity),
      )
      return sorted.map((r) => r.role)
    }
    return []
  }, [userRoles])

  // Build dynamic steps
  const onboardingSteps = useMemo(() => buildOnboardingSteps(roleNames), [roleNames])

  const currentStep = onboardingSteps[currentStepIndex]

  // Pre-fill business name from user record
  const [prefilled, setPrefilled] = useState(false)
  useEffect(() => {
    if (user && !prefilled) {
      setBusinessInfo((prev) => ({
        ...prev,
        businessName: user.businessName || '',
        customerLanguages: (user.customerLanguages ?? []).map((code) => ({
          code,
          label: code,
        })),
      }))
      setPrefilled(true)
    }
  }, [user, prefilled])

  // Resolve selected roles from user record for StepBusinessInfo
  const selectedRolesConfig = user
    ? roleNames
        .map((rn) => ROLES.find((r) => r.clerkRole === rn))
        .filter((r): r is NonNullable<typeof r> => r !== undefined)
    : []

  // Parse the current step key
  const stepKey = currentStep?.key ?? ''
  const isProfileStep = stepKey.startsWith('profile:')
  const profileRole = isProfileStep ? stepKey.split(':')[1] as ClerkRole : null
  const isOrganizerProfile = profileRole !== null && profileRole in ORGANIZER_WIZARD_CONFIG

  // Get organizer steps for the current profile role
  const organizerSteps = profileRole ? getOrganizerSteps(profileRole) : ['basic']

  function goNext() {
    if (currentStepIndex < onboardingSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
      setOrganizerSubStep('basic') // reset sub-steps for next profile
    }
  }

  function goBack() {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1)
      setOrganizerSubStep('basic')
    }
  }

  async function handleBusinessInfoContinue() {
    try {
      await updateBusinessInfo({
        businessName: businessInfo.businessName.trim(),
      })
      goNext()
    } catch (e) {
      setError(parseConvexError(e, 'Failed to save business info.'))
    }
  }

  async function handleComplete() {
    setError(null)
    setCompleting(true)
    try {
      await completeOnboarding()
      if (user && roleNames.length > 0) {
        const config = ROLE_BY_CLERK_ROLE[roleNames[0] as keyof typeof ROLE_BY_CLERK_ROLE]
        if (config) {
          router.replace(`/${user.slug}/${config.key}`)
          return
        }
      }
      router.replace('/dashboard')
    } catch (e) {
      setError(parseConvexError(e, 'Failed to complete onboarding.'))
    } finally {
      setCompleting(false)
    }
  }

  // Organizer profile sub-step navigation
  function organizerGoNext() {
    const currentIdx = organizerSteps.indexOf(organizerSubStep)
    if (currentIdx < organizerSteps.length - 1) {
      setOrganizerSubStep(organizerSteps[currentIdx + 1] as OrganizerSubStep)
    } else {
      goNext() // last sub-step -> next main step
    }
  }

  function organizerGoBack() {
    const currentIdx = organizerSteps.indexOf(organizerSubStep)
    if (currentIdx > 0) {
      setOrganizerSubStep(organizerSteps[currentIdx - 1] as OrganizerSubStep)
    } else {
      goBack() // first sub-step -> previous main step
    }
  }

  if (!user || !onboardingStatus || userRoles === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-secondary">
        <Spinner />
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 640 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 className="text-primary"
            style={{ fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              marginBottom: 8 }}
          >
            Welcome to DiveDispatch
          </h1>
        </div>

        {/* Step indicator — dynamic per-role profile steps */}
        <div style={{ marginBottom: 32 }}>
          <StepIndicator steps={onboardingSteps} currentIndex={currentStepIndex} />
        </div>

        {/* Step content */}
        <div>
          {stepKey === 'business-info' && (
            <StepBusinessInfo
              selectedRoles={selectedRolesConfig}
              values={businessInfo}
              onChange={setBusinessInfo}
              onBack={goBack}
              onContinue={handleBusinessInfoContinue}
            />
          )}

          {isProfileStep && isOrganizerProfile && profileRole && (
            <>
              {organizerSubStep === 'basic' && (
                <OrganizerBasicStep role={profileRole} onSaved={organizerGoNext} onBack={organizerGoBack} />
              )}
              {organizerSubStep === 'agency' && (
                <OrganizerAgencyStep role={profileRole} onSaved={organizerGoNext} onBack={organizerGoBack} />
              )}
              {organizerSubStep === 'languages' && (
                <OrganizerLanguagesStep role={profileRole} onSaved={organizerGoNext} onBack={organizerGoBack} />
              )}
            </>
          )}

          {isProfileStep && !isOrganizerProfile && profileRole && (
            <ProfileFormForRole role={profileRole} onSaved={goNext} />
          )}

          {stepKey === 'preferences' && (
            <Card padding="lg">
              <StepPreferences userRole={roleNames[0] ?? 'DiveCenter'} />
            </Card>
          )}

          {stepKey === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 className="text-primary"
                  style={{ fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    marginBottom: 4 }}
                >
                  Ready to go!
                </h2>
                <p className="text-secondary" style={{ fontSize: 14, lineHeight: 1.6 }}>
                  Your account is configured. Click below to open your dashboard.
                </p>
              </div>
              <Card padding="md">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="text-secondary" style={{ fontSize: 13 }}>
                      {roleNames.length > 1 ? 'Roles' : 'Role'}
                    </span>
                    <span className="text-primary" style={{ fontSize: 13, fontWeight: 500 }}>
                      {roleNames.map((r) => roleLabelForClerkRole(r)).join(', ')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="text-secondary" style={{ fontSize: 13 }}>Profile completion</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: onboardingStatus.percentage >= 100 ? 'var(--color-success)' : 'var(--color-warning)',
                      }}
                    >
                      {onboardingStatus.percentage}%
                    </span>
                  </div>
                </div>
              </Card>
              {onboardingStatus.incomplete.length > 0 && (
                <Card padding="sm">
                  <p className="text-secondary" style={{ fontSize: 12, marginBottom: 6 }}>
                    You can complete these later from your profile settings:
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {onboardingStatus.incomplete.map((item) => (
                      <li className="text-secondary"
                        key={item}
                        style={{ fontSize: 12, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <span style={{ color: 'var(--color-warning)', fontSize: 10 }}>&#9679;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {error && (
                <p style={{ fontSize: 13, color: 'var(--color-destructive)' }}>{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Navigation — preferences and review steps only */}
        {(stepKey === 'preferences' || stepKey === 'review') && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 16,
              gap: 8,
            }}
          >
            <Button variant="secondary" onClick={goBack}>
              Back
            </Button>
            {stepKey !== 'review' ? (
              <Button variant="primary" onClick={goNext}>
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={completing}
                onClick={handleComplete}
              >
                Go to dashboard
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
