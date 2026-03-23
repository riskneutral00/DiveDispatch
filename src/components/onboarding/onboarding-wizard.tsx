'use client'

import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassCard } from '@/components/glass'
import { ROLE_BY_CLERK_ROLE, ROLES } from '@/lib/constants/roles'
import type { Language } from '@/lib/types/language'
import { Spinner } from '@/components/common/spinner'
import { StepIndicator } from '@/components/common/step-indicator'
import { StepBusinessInfo, type BusinessInfoValues } from './step-business-info'
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
// Operator roles get 4 onboarding steps; resource roles get 2.
// Numbering restarts fresh from 1 (not continuing from sign-up).
const OPERATOR_STEPS = [
  { key: 'business-info', label: 'Business' },
  { key: 'profile', label: 'Profile' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'review', label: 'Review' },
] as const

const RESOURCE_STEPS = [
  { key: 'profile', label: 'Profile' },
  { key: 'review', label: 'Review' },
] as const

type OnboardingStep = (typeof OPERATOR_STEPS)[number]['key']

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
  const onboardingStatus = useQuery(api.users.getOnboardingStatus)
  const updateBusinessInfo = useMutation(api.users.updateBusinessInfo)
  const completeOnboarding = useMutation(api.users.completeOnboarding)
  const router = useRouter()

  const [step, setStep] = useState<OnboardingStep>('business-info')
  const [stepInitialized, setStepInitialized] = useState(false)

  // Set first step based on role once user loads (resources skip business-info)
  useEffect(() => {
    if (user && !stepInitialized) {
      const isOp = ROLES.find((r) => r.clerkRole === user.role)?.displayGroup === 'operator'
      setStep(isOp ? 'business-info' : 'profile')
      setStepInitialized(true)
    }
  }, [user, stepInitialized])
  const [dcSubStep, setDcSubStep] = useState<DcSubStep>('dc-basic')
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [businessInfo, setBusinessInfo] = useState<BusinessInfoValues>({
    businessName: '',
    customerLanguages: [],
  })

  // Pre-fill business name from user record (set during createUser as firstName + lastName)
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
  const selectedRoles = user
    ? ROLES.filter((r) => r.clerkRole === user.role)
    : []

  const isDiveCenter = user?.role === 'DiveCenter'
  const isOperator = user ? (ROLES.find((r) => r.clerkRole === user.role)?.displayGroup === 'operator') : false
  const onboardingSteps = isOperator ? OPERATOR_STEPS : RESOURCE_STEPS

  // Fresh step index starting at 0 (not offset from sign-up)
  const onboardingStepIndex = onboardingSteps.findIndex((s) => s.key === step)

  async function handleBusinessInfoContinue() {
    try {
      await updateBusinessInfo({
        businessName: businessInfo.businessName.trim(),
        customerLanguages: businessInfo.customerLanguages.map((l) => l.code),
      })
      setStep('profile')
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
          router.replace(`/${user.slug}/${config.key}/dashboard`)
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

  function goNext() {
    const next = onboardingSteps[onboardingStepIndex + 1]
    if (next) setStep(next.key)
  }

  function goBack() {
    const prev = onboardingSteps[onboardingStepIndex - 1]
    if (prev) setStep(prev.key)
  }

  // DC profile sub-step navigation
  function dcGoNext() {
    if (dcSubStep === 'dc-basic') setDcSubStep('dc-agency')
    else if (dcSubStep === 'dc-agency') setDcSubStep('dc-languages')
    else goNext() // dc-languages → preferences
  }

  function dcGoBack() {
    if (dcSubStep === 'dc-languages') setDcSubStep('dc-agency')
    else if (dcSubStep === 'dc-agency') setDcSubStep('dc-basic')
    else goBack() // dc-basic → business-info
  }

  if (!user || !onboardingStatus) {
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

        {/* Step indicator — role-appropriate steps, fresh 1-N numbering */}
        <div style={{ marginBottom: 32 }}>
          <StepIndicator steps={onboardingSteps} currentIndex={onboardingStepIndex} />
        </div>

        {/* Step content */}
        <div>
          {step === 'business-info' && (
            <StepBusinessInfo
              selectedRoles={selectedRoles}
              values={businessInfo}
              onChange={setBusinessInfo}
              onBack={goBack}
              onContinue={handleBusinessInfoContinue}
            />
          )}

          {step === 'profile' && (
            isDiveCenter ? (
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
            ) : (
              <ProfileFormForRole role={user.role} onSaved={goNext} />
            )
          )}

          {step === 'preferences' && (
            <GlassCard padding="lg">
              <StepPreferences userRole={user.role} />
            </GlassCard>
          )}

          {step === 'review' && (
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
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Role</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {user.role}
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
                        <span style={{ color: 'var(--color-warning)', fontSize: 10 }}>●</span>
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
        {(step === 'preferences' || step === 'review') && (
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
            {step !== 'review' ? (
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
