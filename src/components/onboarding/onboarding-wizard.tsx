'use client'

import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassCard } from '@/components/glass'
import { ROLE_BY_CLERK_ROLE } from '@/lib/constants/roles'
import { AgentProfileForm } from '@/components/dashboard/agent-profile-form'
import { BoatProfileForm } from '@/components/dashboard/boat-profile-form'
import { CompressorProfileForm } from '@/components/dashboard/compressor-profile-form'
import { DiveCenterProfileForm } from '@/components/dashboard/dive-center-profile-form'
import { DiveMasterProfileForm } from '@/components/dashboard/divemaster-profile-form'
import { EquipmentProfileForm } from '@/components/dashboard/equipment-profile-form'
import { InstructorProfileForm } from '@/components/dashboard/instructor-profile-form'
import { PoolProfileForm } from '@/components/dashboard/pool-profile-form'
import { StepPreferences } from './step-preferences'

type WizardStep = 'profile' | 'preferences' | 'review'

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'review', label: 'Review' },
]

function ProfileFormForRole({ role }: { role: string }) {
  switch (role) {
    case 'DiveCenter':    return <DiveCenterProfileForm />
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
  const completeOnboarding = useMutation(api.users.completeOnboarding)
  const router = useRouter()

  const [step, setStep] = useState<WizardStep>('profile')
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentStepIndex = STEPS.findIndex((s) => s.key === step)

  async function handleComplete() {
    setError(null)
    setCompleting(true)
    try {
      await completeOnboarding()
      // Redirect to dashboard for the user's role
      if (user) {
        const config = ROLE_BY_CLERK_ROLE[user.role as keyof typeof ROLE_BY_CLERK_ROLE]
        if (config) {
          router.replace(`${config.route}/${user.slug}/dashboard`)
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

  if (!user || !onboardingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span
          className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-hidden
        />
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
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Let&apos;s set up your account. This takes about 2 minutes.
          </p>
        </div>

        {/* Step indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0,
            marginBottom: 32,
          }}
        >
          {STEPS.map((s, i) => {
            const isCurrent = s.key === step
            const isDone = i < currentStepIndex
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1px solid',
                      borderColor: isCurrent || isDone
                        ? 'var(--color-primary)'
                        : 'var(--color-glass-border)',
                      background: isDone
                        ? 'var(--color-primary)'
                        : isCurrent
                        ? 'var(--color-glass-bg-elevated)'
                        : 'var(--color-glass-bg)',
                      color: isDone
                        ? 'var(--color-text-on-primary)'
                        : isCurrent
                        ? 'var(--color-primary)'
                        : 'var(--color-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      transition: 'all var(--transition-speed) ease',
                    }}
                  >
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: isCurrent ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      letterSpacing: '0.04em',
                      transition: 'color var(--transition-speed) ease',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      width: 48,
                      height: 1,
                      background: i < currentStepIndex ? 'var(--color-primary)' : 'var(--color-glass-border)',
                      margin: '0 8px',
                      marginBottom: 20,
                      transition: 'background var(--transition-speed) ease',
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Step content */}
        <GlassCard elevated padding="lg">
          {step === 'profile' && <ProfileFormForRole role={user.role} />}
          {step === 'preferences' && (
            <StepPreferences userRole={user.role} />
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
        </GlassCard>

        {/* Navigation */}
        <div
          style={{
            display: 'flex',
            justifyContent: step === 'profile' ? 'flex-end' : 'space-between',
            marginTop: 16,
            gap: 8,
          }}
        >
          {step !== 'profile' && (
            <GlassButton
              variant="secondary"
              onClick={() => setStep(STEPS[currentStepIndex - 1].key)}
            >
              Back
            </GlassButton>
          )}
          {step !== 'review' ? (
            <GlassButton
              variant="primary"
              onClick={() => setStep(STEPS[currentStepIndex + 1].key)}
            >
              Continue
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
      </div>
    </div>
  )
}
