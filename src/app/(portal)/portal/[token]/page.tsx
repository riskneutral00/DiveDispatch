'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import dynamic from 'next/dynamic'
import { MapPin, CheckCircle2, Clock, Users } from 'lucide-react'
import { api } from '../../../../../convex/_generated/api'
import { GlassCard } from '../../../../components/glass/glass-card'
import { GlassBadge } from '../../../../components/glass/glass-badge'
import { GlassButton } from '../../../../components/glass/glass-button'
import { StepContact } from '../../../../components/portal/step-contact'
import type { EquipmentData } from '../../../../components/portal/step-equipment'
import { Spinner } from '@/components/common/spinner'
import { StepIndicator } from '@/components/common/step-indicator'

const StepMedical = dynamic(
  () => import('../../../../components/portal/step-medical').then((m) => m.StepMedical),
  { loading: () => <Spinner />, ssr: false },
)

const StepWaiver = dynamic(
  () => import('../../../../components/portal/step-waiver').then((m) => m.StepWaiver),
  { loading: () => <Spinner />, ssr: false },
)

const StepEquipment = dynamic(
  () => import('../../../../components/portal/step-equipment').then((m) => m.StepEquipment),
  { loading: () => <Spinner />, ssr: false },
)

const StepSafety = dynamic(
  () => import('../../../../components/portal/step-safety').then((m) => m.StepSafety),
  { loading: () => <Spinner />, ssr: false },
)

const PortalSubmit = dynamic(
  () => import('../../../../components/portal/portal-submit').then((m) => m.PortalSubmit),
  { loading: () => <Spinner />, ssr: false },
)

// ── Types ─────────────────────────────────────────────────────────────────────

type PortalStep = 'contact' | 'medical' | 'waiver' | 'equipment' | 'safety' | 'submit'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortalTokenPage() {
  const params = useParams()
  const router = useRouter()
  const token = typeof params.token === 'string' ? params.token : ''

  const result = useQuery(api.bookingLinks.getByToken, token ? { token } : 'skip')
  const progress = useQuery(api.portalDraft.getPortalProgress, token ? { token } : 'skip')

  const [currentStep, setCurrentStep] = useState<PortalStep>('contact')
  const [contactDone, setContactDone] = useState(false)
  const [medicalDone, setMedicalDone] = useState(false)
  const [waiverDone, setWaiverDone] = useState(false)
  // Equipment data held locally until submit step
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_equipmentData, setEquipmentData] = useState<EquipmentData | null>(null)

  // Restore step progress from server on mount so browser refresh
  // does not lose completed steps.
  const hasInitialized = useRef(false)
  useEffect(() => {
    if (!progress || hasInitialized.current) return
    hasInitialized.current = true
    setContactDone(progress.contactComplete)
    setMedicalDone(progress.medicalComplete)
    setWaiverDone(progress.waiverComplete)
    setCurrentStep(progress.firstIncompleteStep as PortalStep)
  }, [progress])

  // Redirect expired/not-found tokens to the expired page.
  useEffect(() => {
    if (result?.status === 'expired' || result?.status === 'not_found') {
      router.replace('/portal/expired')
    }
  }, [result, router])

  // Loading
  if (result === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ color: 'var(--color-primary)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  // While redirect fires, render nothing
  if (result.status === 'expired' || result.status === 'not_found') {
    return null
  }

  // Token already used — customer completed portal submission
  if (result.status === 'completed') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <GlassCard className="max-w-md w-full text-center" padding="lg">
          <div className="mb-4 flex justify-center">
            <CheckCircle2 size={40} style={{ color: 'var(--color-success)' }} />
          </div>
          <h1
            className="text-xl font-semibold mb-2"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
          >
            Submission Complete
          </h1>
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
            {result.customerName}
          </p>
          <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            Your submission is complete.{result.operatorName ? ` ${result.operatorName}` : ''} will be
            in touch before your activity{result.startDate ? ` on ${result.startDate}` : ''}.
          </p>
          <GlassButton variant="primary" size="md" onClick={() => window.close()}>
            Close
          </GlassButton>
        </GlassCard>
      </div>
    )
  }

  // Booking no longer in Draft — portal closed
  if (result.status === 'closed') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <GlassCard className="max-w-md w-full text-center" padding="lg">
          <div className="mb-4 flex justify-center">
            <Clock size={40} style={{ color: 'var(--color-warning)' }} />
          </div>
          <h1
            className="text-xl font-semibold mb-3"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
          >
            Booking Closed
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            This booking is no longer accepting submissions. Please contact your dive operator for
            assistance.
          </p>
        </GlassCard>
      </div>
    )
  }

  // Valid token — portal entry point
  const { customerName, operatorName, activityType, startDate, endDate, diverCount } = result

  const STEPS: { key: PortalStep; label: string }[] = [
    { key: 'contact', label: 'Contact' },
    { key: 'medical', label: 'Medical' },
    { key: 'waiver', label: 'Waiver' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'safety', label: 'Safety' },
    { key: 'submit', label: 'Submit' },
  ]

  function isStepComplete(step: PortalStep): boolean {
    switch (step) {
      case 'contact':
        return contactDone
      case 'medical':
        return medicalDone
      case 'waiver':
        return waiverDone
      case 'equipment':
        return true // always optional
      case 'safety':
        return true // always optional
      default:
        return false
    }
  }

  function renderStep() {
    switch (currentStep) {
      case 'contact':
        return (
          <StepContact
            token={token}
            onComplete={() => {
              setContactDone(true)
              setCurrentStep('medical')
            }}
          />
        )
      case 'medical':
        return (
          <StepMedical
            token={token}
            onComplete={() => {
              setMedicalDone(true)
              setCurrentStep('waiver')
            }}
          />
        )
      case 'waiver':
        return (
          <StepWaiver
            operatorName={operatorName}
            participantName={customerName}
            dateOfBirth=""
            onComplete={() => {
              setWaiverDone(true)
              setCurrentStep('equipment')
            }}
            onBack={() => setCurrentStep('medical')}
          />
        )
      case 'equipment':
        return (
          <div className="space-y-4">
            <StepEquipment onChange={(data) => setEquipmentData(data)} />
            <div className="flex justify-end">
              <GlassButton variant="primary" size="md" onClick={() => setCurrentStep('safety')}>
                Continue
              </GlassButton>
            </div>
          </div>
        )
      case 'safety':
        return (
          <StepSafety
            token={token}
            onComplete={() => setCurrentStep('submit')}
            onBack={() => setCurrentStep('equipment')}
          />
        )
      case 'submit':
        return <PortalSubmit token={token} />
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <header className="text-center space-y-2">
          <p
            className="text-sm font-medium uppercase tracking-widest"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {operatorName}
          </p>
          <h1
            className="text-2xl sm:text-3xl font-bold"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
          >
            Welcome, {customerName}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Please complete your booking paperwork below
          </p>
        </header>

        {/* Booking summary card */}
        <GlassCard padding="md">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {activityType.map((type) => (
                <GlassBadge key={type} variant="info" size="sm">
                  {type}
                </GlassBadge>
              ))}
            </div>
            <div
              className="flex flex-col gap-1.5 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <div className="flex items-center gap-2">
                <MapPin size={14} />
                <span>{startDate === endDate ? startDate : `${startDate} – ${endDate}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={14} />
                <span>
                  {diverCount} {diverCount === 1 ? 'diver' : 'divers'}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Step progress */}
        <StepIndicator
          steps={STEPS}
          currentIndex={STEPS.findIndex((s) => s.key === currentStep)}
        />

        {/* Active step */}
        <div>{renderStep()}</div>
      </div>
    </div>
  )
}
