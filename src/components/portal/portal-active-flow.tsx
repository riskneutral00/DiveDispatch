'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { api } from '@/lib/convex-generated'
import { StepContact } from './step-contact'
import { Spinner } from '@/components/ui/spinner'
import { StepIndicator } from '@/components/ui/step-indicator'
import { computeStep, type ClientPortalStep } from '@/lib/portal/compute-step'
import { PortalStepShell } from './portal-step-shell'
import { PortalHeader } from './portal-header'
import type { EquipmentData } from './step-equipment'
import type { PortalProgress } from '../../../convex/portalDraft'

function PortalStepLoading() {
  return <Spinner />
}

const StepMedical = dynamic(
  () => import('./step-medical').then((m) => m.StepMedical),
  { loading: () => <PortalStepLoading />, ssr: false },
)

const StepWaiver = dynamic(
  () => import('./step-waiver').then((m) => m.StepWaiver),
  { loading: () => <PortalStepLoading />, ssr: false },
)

const StepEquipment = dynamic(
  () => import('./step-equipment').then((m) => m.StepEquipment),
  { loading: () => <PortalStepLoading />, ssr: false },
)

const StepSafety = dynamic(
  () => import('./step-safety').then((m) => m.StepSafety),
  { loading: () => <PortalStepLoading />, ssr: false },
)

const PortalSubmit = dynamic(
  () => import('./portal-submit').then((m) => m.PortalSubmit),
  { loading: () => <PortalStepLoading />, ssr: false },
)

// ── Types ─────────────────────────────────────────────────────────────────────

type PortalStep = ClientPortalStep

interface PortalActiveFlowProps {
  token: string
  customerName: string
  operatorName: string
  activityType: string[]
  startDate: string
  endDate: string
  diverCount: number
  progress: PortalProgress | null | undefined
}

// ── Component ────────────────────────────────────────────────────────────────

export function PortalActiveFlow({
  token,
  customerName,
  operatorName,
  activityType,
  startDate,
  endDate,
  diverCount,
  progress,
}: PortalActiveFlowProps) {
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

  const dateOfBirth = progress?.contactData?.dateOfBirth ?? ''

  // Local step override allows user navigation; server-derived default used until override
  const serverStep = computeStep(progress)
  const [stepOverride, setStepOverride] = useState<PortalStep | null>(null)
  const currentStep = stepOverride ?? serverStep

  const t = useTranslations('portal')

  const steps: { key: PortalStep; label: string }[] = useMemo(
    () => [
      { key: 'contact', label: t('stepContact') },
      { key: 'medical', label: t('stepMedical') },
      { key: 'waiver', label: t('stepWaiver') },
      { key: 'equipment', label: t('stepEquipment') },
      { key: 'safety', label: t('stepSafety') },
      { key: 'submit', label: t('stepSubmit') },
    ],
    [t],
  )

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
        <PortalHeader
          customerName={customerName}
          operatorName={operatorName}
          activityType={activityType}
          startDate={startDate}
          endDate={endDate}
          diverCount={diverCount}
        />

        {/* Step progress */}
        <StepIndicator
          steps={steps}
          currentIndex={steps.findIndex((s) => s.key === currentStep)}
        />

        {/* Active step */}
        <div>{renderStep()}</div>
      </div>
    </div>
  )
}
