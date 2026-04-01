'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery } from 'convex/react'
import dynamic from 'next/dynamic'
import { MapPin, CheckCircle2, Clock, Users } from 'lucide-react'
import { api } from '../../../../../convex/_generated/api'
import { GlassCard } from '../../../../components/ui/glass-card'
import { GlassBadge } from '../../../../components/ui/glass-badge'
import { GlassButton } from '../../../../components/ui/glass-button'
import { StepContact } from '../../../../components/portal/step-contact'
import { Spinner } from '@/components/ui/spinner'
import { StepIndicator } from '@/components/onboarding/step-indicator'
import { computeStep, type ClientPortalStep } from '@/lib/portal/compute-step'
import { PortalStepShell } from '@/components/portal/portal-step-shell'
import type { EquipmentData } from '@/components/portal/step-equipment'

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

type PortalStep = ClientPortalStep

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortalTokenPage() {
  const params = useParams()
  const router = useRouter()
  const token = typeof params.token === 'string' ? params.token : ''

  const result = useQuery(api.bookingLinks.getByToken, token ? { token } : 'skip')
  const progress = useQuery(api.portalDraft.getPortalProgress, token ? { token } : 'skip')
  const saveEquipment = useMutation(api.portalDraft.saveEquipmentData)

  // Debounced equipment save — avoids hammering Convex on every keystroke
  const equipmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleEquipmentChange = useCallback(
    (data: EquipmentData) => {
      if (equipmentTimerRef.current) clearTimeout(equipmentTimerRef.current)
      equipmentTimerRef.current = setTimeout(() => {
        saveEquipment({ token, ...data }).catch(() => {})
      }, 600)
    },
    [saveEquipment, token],
  )

  // Derive completion booleans directly from server query
  const contactDone = progress?.contactComplete ?? false
  const medicalDone = progress?.medicalComplete ?? false
  const waiverDone = progress?.waiverComplete ?? false
  const dateOfBirth = progress?.contactData?.dateOfBirth ?? ''

  // Local step override allows user navigation; server-derived default used until override
  const serverStep = computeStep(progress)
  const [stepOverride, setStepOverride] = useState<PortalStep | null>(null)
  const currentStep = stepOverride ?? serverStep

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
            className="text-xl font-semibold mb-2 text-primary"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Submission Complete
          </h1>
          <p className="text-sm font-medium mb-3 text-primary">
            {result.customerName}
          </p>
          <p className="text-sm leading-relaxed mb-6 text-secondary">
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
            className="text-xl font-semibold mb-3 text-primary"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Booking Closed
          </h1>
          <p className="text-sm leading-relaxed text-secondary">
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
            onComplete={() => setStepOverride('medical')}
          />
        )
      case 'medical':
        return (
          <StepMedical
            token={token}
            onComplete={() => setStepOverride('waiver')}
          />
        )
      case 'waiver':
        return (
          <StepWaiver
            operatorName={operatorName}
            participantName={customerName}
            dateOfBirth={dateOfBirth}
            bookingStartDate={startDate}
            onComplete={() => setStepOverride('equipment')}
            onBack={() => setStepOverride('medical')}
          />
        )
      case 'equipment':
        return (
          <PortalStepShell
            onContinue={() => setStepOverride('safety')}
            onBack={() => setStepOverride('waiver')}
          >
            <StepEquipment onChange={handleEquipmentChange} />
          </PortalStepShell>
        )
      case 'safety':
        return (
          <StepSafety
            token={token}
            onComplete={() => setStepOverride('submit')}
            onBack={() => setStepOverride('equipment')}
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
            className="text-sm font-medium uppercase tracking-widest text-secondary"
          >
            {operatorName}
          </p>
          <h1
            className="text-2xl sm:text-3xl font-bold text-primary"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Welcome, {customerName}
          </h1>
          <p className="text-sm text-secondary">
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
              className="flex flex-col gap-1.5 text-sm text-secondary"
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
