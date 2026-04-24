'use client'

import React, { useCallback, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '../ui/card'
import { CardTitle } from '../ui/card-title'
import { InlineError } from '../ui/inline-error'
import { Checkbox } from '../ui/checkbox'
import { Input } from '../ui/input'
import { DateField } from '../ui/date-field'
import { SignaturePad, SignaturePadHandle } from './signature-pad'
import { ShieldCheck } from 'lucide-react'
import { toISODateString } from '@/lib/utils/date'
import { calcAgeAtDate } from '@/lib/constants/activity-rules'
import { NON_AGENCY_DISCLOSURE, LIABILITY_RELEASE_TEXT } from '@/lib/constants/waiver-text'
import { usePortalStep } from '@/lib/hooks/use-portal-step'
import { isSignatureValid } from '@/lib/utils/signature-coverage'
import { PortalStepShell } from '@/components/portal/portal-step-shell'
import { FieldRow } from '@/components/ui/field-row'

export type WaiverData = {
  acknowledged: boolean
  hasInsurance: boolean
  insurancePolicyNumber?: string
  signatureBlob: Blob
  date: string
  guardianName?: string
  guardianSignatureBlob?: Blob
}

interface StepWaiverProps {
  operatorName: string
  participantName: string
  dateOfBirth: string
  onComplete: (data: WaiverData) => void
  onBack?: () => void
  submitting?: boolean
  bookingStartDate?: string
}

const todayLocal = () => toISODateString(new Date())

function LegalBlock({ text }: { text: string }) {
  return (
    <div
      className="rounded-theme p-3 text-body leading-relaxed overflow-y-auto overflow-x-hidden text-secondary glass"
      style={{ maxHeight: 140, whiteSpace: 'pre-wrap' }}
    >
      {text}
    </div>
  )
}

export function StepWaiver({
  operatorName,
  participantName,
  dateOfBirth,
  onComplete,
  onBack,
  submitting = false,
  bookingStartDate,
}: StepWaiverProps) {
  const tWaiver = useTranslations('waiver')
  const tPortal = useTranslations('portal')
  const tCommon = useTranslations('common')

  const refDate = bookingStartDate ?? todayLocal()
  const isUnder18 = dateOfBirth ? calcAgeAtDate(dateOfBirth, refDate) < 18 : false

  const [acknowledged, setAcknowledged] = useState(false)
  const [hasInsurance, setHasInsurance] = useState<'yes' | 'no' | null>(null)
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [guardianName, setGuardianName] = useState('')
  const [hasSig, setHasSig] = useState(false)
  const [hasGuardianSig, setHasGuardianSig] = useState(false)
  const { errors, setErrors, clearError } = usePortalStep()

  const signatureRef = useRef<SignaturePadHandle>(null)
  const guardianSignatureRef = useRef<SignaturePadHandle>(null)

  const validateSignatureCoverage = useCallback(() => {
    const imageData = signatureRef.current?.getImageData()
    if (!imageData) {
      setHasSig(false)
      return
    }
    const valid = isSignatureValid(imageData)
    setHasSig(valid)
    if (valid) clearError('signature')
  }, [clearError])

  const validateGuardianCoverage = useCallback(() => {
    const imageData = guardianSignatureRef.current?.getImageData()
    if (!imageData) {
      setHasGuardianSig(false)
      return
    }
    const valid = isSignatureValid(imageData)
    setHasGuardianSig(valid)
    if (valid) clearError('guardianSignature')
  }, [clearError])

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!acknowledged) next.acknowledged = tCommon('fieldRequired', { field: 'Acknowledgment' })
    if (!hasSig) next.signature = tCommon('fieldRequired', { field: 'Signature' })
    if (!date) next.date = tCommon('fieldRequired', { field: 'Date' })
    if (hasInsurance === null) next.hasInsurance = tCommon('fieldRequired', { field: 'Selection' })
    if (hasInsurance === 'yes' && !insurancePolicyNumber.trim()) {
      next.insurancePolicyNumber = tCommon('fieldRequired', { field: 'Policy number' })
    }
    if (isUnder18) {
      if (!guardianName.trim()) next.guardianName = tCommon('fieldRequired', { field: 'Guardian name' })
      if (!hasGuardianSig) next.guardianSignature = tCommon('fieldRequired', { field: 'Guardian signature' })
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const signatureBlob = await signatureRef.current?.getBlob()
    if (!signatureBlob) {
      setErrors({ ...errors, signature: tCommon('fieldRequired', { field: 'Signature' }) })
      return
    }

    let guardianSignatureBlob: Blob | undefined
    if (isUnder18) {
      const blob = await guardianSignatureRef.current?.getBlob()
      if (!blob) {
        setErrors({ ...errors, guardianSignature: tCommon('fieldRequired', { field: 'Guardian signature' }) })
        return
      }
      guardianSignatureBlob = blob
    }

    onComplete({
      acknowledged,
      hasInsurance: hasInsurance === 'yes',
      insurancePolicyNumber: hasInsurance === 'yes' ? insurancePolicyNumber.trim() : undefined,
      signatureBlob,
      date,
      guardianName: isUnder18 ? guardianName.trim() : undefined,
      guardianSignatureBlob,
    })
  }

  const labelClass = 'text-body font-medium'

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <Card padding="md">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-accent" />
            <CardTitle>{tPortal('sectionNonAgency')}</CardTitle>
          </div>

          <div>
            <p className={`${labelClass} text-secondary`}>
              {tPortal('padiMemberName')}
            </p>
            <p
              className="mt-1 text-body font-medium text-primary"
            >
              {operatorName}
            </p>
          </div>

          <LegalBlock
            text={NON_AGENCY_DISCLOSURE.replace(/____________/g, operatorName)}
          />
        </div>
      </Card>

      <Card padding="md">
        <div className="space-y-3">
          <CardTitle>{tPortal('sectionLiability')}</CardTitle>

          <p className="text-body text-secondary">
            {tPortal('agreeTo', { name: participantName })}
          </p>

          <LegalBlock
            text={LIABILITY_RELEASE_TEXT.replace(/_____________/g, operatorName)}
          />

          <Checkbox
            label={
              <span className="text-body leading-snug text-secondary">
                {tWaiver('ackCheckbox')}
              </span>
            }
            checked={acknowledged}
            onChange={(v) => {
              setAcknowledged(v)
              if (v) clearError('acknowledged')
            }}
          />
          {errors.acknowledged && (
            <InlineError>{errors.acknowledged}</InlineError>
          )}
        </div>
      </Card>

      <Card padding="md">
        <div className="space-y-3">
          <CardTitle>{tPortal('sectionInsurance')}</CardTitle>
          <p className="text-body text-secondary">
            {tPortal('insuranceQuestion')}
          </p>
          <div className="flex gap-6">
            {(['yes', 'no'] as const).map((val) => (
              <Checkbox
                key={val}
                as="radio"
                name="hasInsurance"
                value={val}
                label={val === 'yes' ? tCommon('yes') : tCommon('no')}
                checked={hasInsurance === val}
                onChange={() => {
                  setHasInsurance(val)
                  clearError('hasInsurance')
                }}
              />
            ))}
          </div>

          {errors.hasInsurance && (
            <InlineError>{errors.hasInsurance}</InlineError>
          )}

          {hasInsurance === 'yes' && (
            <FieldRow>
              <Input
                label={tPortal('policyNumber')}
                value={insurancePolicyNumber}
                onChange={(e) => {
                  setInsurancePolicyNumber(e.target.value)
                  if (e.target.value.trim()) clearError('insurancePolicyNumber')
                }}
                placeholder={tPortal('placeholderInsurance')}
                error={errors.insurancePolicyNumber}
                className="field-md"
              />
            </FieldRow>
          )}
        </div>
      </Card>

      <Card padding="md">
        <div className="space-y-4">
          <CardTitle>{tPortal('sectionParticipantSig')}</CardTitle>

          <SignaturePad
            ref={signatureRef}
            label={tPortal('signature')}
            onChange={(has) => {
              if (!has) setHasSig(false)
            }}
            onDrawEnd={validateSignatureCoverage}
            error={errors.signature}
          />

          <DateField
            label={tPortal('date')}
            value={date || null}
            onChange={(v) => setDate(v ?? '')}
            error={errors.date}
            max={todayLocal()}
            className="field-md"
          />
        </div>
      </Card>

      {isUnder18 && (
        <Card padding="md">
          <div className="space-y-4">
            <div>
              <CardTitle>{tPortal('sectionGuardianSig')}</CardTitle>
              <p className="text-body mt-1 text-secondary">
                {tPortal('guardianReason')}
              </p>
            </div>

            <Input
              label={tPortal('guardianFullName')}
              value={guardianName}
              onChange={(e) => {
                setGuardianName(e.target.value)
                if (e.target.value.trim()) clearError('guardianName')
              }}
              placeholder={tPortal('placeholderLegalName')}
              error={errors.guardianName}
              className="field-md"
            />

            <SignaturePad
              ref={guardianSignatureRef}
              label={tPortal('guardianSignature')}
              onChange={(has) => {
                if (!has) setHasGuardianSig(false)
              }}
              onDrawEnd={validateGuardianCoverage}
              error={errors.guardianSignature}
            />
          </div>
        </Card>
      )}

      <PortalStepShell
        onBack={onBack}
        backVariant="secondary"
        continueType="submit"
        submitting={submitting}
        continueFullWidth={!onBack}
        continueClassName={onBack ? 'flex-1' : undefined}
      >
        <></>
      </PortalStepShell>
    </form>
  )
}
