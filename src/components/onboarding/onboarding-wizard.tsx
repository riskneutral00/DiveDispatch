'use client'

import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassCard } from '@/components/glass'
import { ROLE_BY_CLERK_ROLE, ROLES } from '@/lib/constants/roles'
import type { Language } from '@/lib/types/language'
import { Spinner } from '@/components/common/spinner'
import { StepIndicator } from '@/components/common/step-indicator'
import { StepBusinessInfo, type BusinessInfoValues } from './step-business-info'
import { buildOnboardingSteps, roleLabelForClerkRole } from './onboarding-steps'
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
import { StepPreferences } from './step-preferences'

// DiveCenter profile has internal sub-steps
type DcSubStep = 'dc-basic' | 'dc-agency' | 'dc-languages'

function ProfileFormForRole({ role, onSaved }: { role: string; onSaved: () => void }) {
  switch (role) {
    case 'Agent':         return <AgentProfileForm />
    case 'Instructor':    return <InstructorProfileForm />
    case 'DiveMaster':    return <DiveMasterProfileForm />
    case 'Boat':          return <BoatProfileForm />
    case 'Equipment':     return <EquipmentProfileForm />
    case 'Pool':          return <PoolProfileForm />
    case 'Compressor':    return <CompressorProfileForm />
    default:
      return (
        <GlassCard padding="md">
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            Profile setup for <strong>{role}</strong> is available from your dashboard settings.
          </p>
        </GlassCard>
      )
  }
}

export function OnboardingWizard() {
  const user = useQuery(api.users.me)
  const userRoles = useQuery(api.userRoles.myRoles)
  const onboardingStatus = useQuery(api.users.getOnboardingStatus)
  const updateBusinessInfo = useMutation(api.users.updateBusinessInfo)
  const completeOnboarding = useMutation(api.users.completeOnboarding)
  const router = useRouter()

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [dcSubStep, setDcSubStep] = useState<DcSubStep>('dc-basic')
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [businessInfo, setBusinessInfo] = useState<BusinessInfoValues>({
    businessName: '',
    customerLanguages: [],
  })

  // Derive the role names from userRoles (multi-role) or fall back to user.role (single-role)
  const roleNames = useMemo(() => {
    if (userRoles && userRoles.length > 0) {
      // Primary first, then the rest in creation order
      const sorted = [...userRoles].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1
        if (!a.isPrimary && b.isPrimary) return 1
        return a.createdAt - b.createdAt
      })
      return sorted.map((r) => r.role)
    }
    if (user) return [user.role]
    return []
  }, [userRoles, user])

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
  const profileRole = isProfileStep ? stepKey.split(':')[1] : null
  const isDiveCenterProfile = profileRole === 'DiveCenter'

  function goNext() {
    if (currentStepIndex < onboardingSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
      setDcSubStep('dc-basic') // reset DC sub-steps for next profile
    }
  }

  function goBack() {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1)
      setDcSubStep('dc-basic')
    }
  }

  async function handleBusinessInfoContinue() {
    try {
      await updateBusinessInfo({
        businessName: businessInfo.businessName.trim(),
        customerLanguages: businessInfo.customerLanguages.map((l) => l.code),
      })
      goNext()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save business info.')
    }
  }

  async function handleComplete() {
    setError(null)
    setCompleting(true)
    try {
      await completeOnboarding()
      if (user) {
        const config = ROLE_BY_CLERK_ROLE[user.role as keyof typeof ROLE_BY_CLERK_ROLE]
        if (config) {
          router.replace(`/${user.slug}/${config.key}`)
          return
        }
      }
      router.replace('/dashboard')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to complete onboarding.'
      setError(msg)
    } finally {
      setCompleting(false)
    }
  }

  // DC profile sub-step navigation
  function dcGoNext() {
    if (dcSubStep === 'dc-basic') setDcSubStep('dc-agency')
    else if (dcSubStep === 'dc-agency') setDcSubStep('dc-languages')
    else goNext() // dc-languages -> next step
  }

  function dcGoBack() {
    if (dcSubStep === 'dc-languages') setDcSubStep('dc-agency')
    else if (dcSubStep === 'dc-agency') setDcSubStep('dc-basic')
    else goBack() // dc-basic -> previous step
  }

  if (!user || !onboardingStatus || userRoles === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--color-text-secondary)' }}>
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
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--color-text-primary)',
              marginBottom: 8,
            }}
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

          {isProfileStep && isDiveCenterProfile && (
            <>
              {dcSubStep === 'dc-basic' && (
                <DcBasicStep onSaved={dcGoNext} onBack={dcGoBack} />
              )}
              {dcSubStep === 'dc-agency' && (
                <DcAgencyStep onSaved={dcGoNext} onBack={dcGoBack} />
              )}
              {dcSubStep === 'dc-languages' && (
                <DcLanguagesStep onSaved={dcGoNext} onBack={dcGoBack} />
              )}
            </>
          )}

          {isProfileStep && !isDiveCenterProfile && profileRole && (
            <ProfileFormForRole role={profileRole} onSaved={goNext} />
          )}

          {stepKey === 'preferences' && (
            <GlassCard padding="lg">
              <StepPreferences userRole={user.role} />
            </GlassCard>
          )}

          {stepKey === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: 'var(--color-text-primary)',
                    marginBottom: 4,
                  }}
                >
                  Ready to go!
                </h2>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                  Your account is configured. Click below to open your dashboard.
                </p>
              </div>
              <GlassCard padding="md">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      {roleNames.length > 1 ? 'Roles' : 'Role'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {roleNames.map((r) => roleLabelForClerkRole(r)).join(', ')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Profile completion</span>
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
              </GlassCard>
              {onboardingStatus.incomplete.length > 0 && (
                <GlassCard padding="sm">
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                    You can complete these later from your profile settings:
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {onboardingStatus.incomplete.map((item) => (
                      <li
                        key={item}
                        style={{ fontSize: 12, color: 'var(--color-text-secondary)', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <span style={{ color: 'var(--color-warning)', fontSize: 10 }}>&#9679;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </GlassCard>
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
            <GlassButton variant="secondary" onClick={goBack}>
              Back
            </GlassButton>
            {stepKey !== 'review' ? (
              <GlassButton variant="primary" onClick={goNext}>
                Next
              </GlassButton>
            ) : (
              <GlassButton
                variant="primary"
                loading={completing}
                onClick={handleComplete}
              >
                Go to dashboard
              </GlassButton>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
