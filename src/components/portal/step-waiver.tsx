'use client'

import React, { useCallback, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '../ui/card'
import { InlineError } from '../ui/inline-error'
import { Checkbox } from '../ui/checkbox'
import { Input } from '../ui/input'
import { SignaturePad, SignaturePadHandle } from './signature-pad'
import { ShieldCheck } from 'lucide-react'
import { toISODateString } from '@/lib/utils/date'
import { calcAgeAtDate } from '@/lib/constants/activity-rules'
import { NON_AGENCY_DISCLOSURE, LIABILITY_RELEASE_TEXT } from '@/lib/constants/waiver-text'
import { usePortalStep } from '@/lib/hooks/use-portal-step'
import { isSignatureValid } from '@/lib/utils/signature-coverage'
import { PortalStepShell } from '@/components/portal/portal-step-shell'

// ── Types ────────────────────────────────────────────────────────────────────

export type WaiverData = {
  acknowledged: boolean
  hasInsurance: boolean
  insurancePolicyNumber?: string
  /** PNG blob of participant signature */
  signatureBlob: Blob
  date: string
  guardianName?: string
  /** PNG blob of guardian signature (required if under 18) */
  guardianSignatureBlob?: Blob
}

interface StepWaiverProps {
  /** Operator name, pre-fills the PADI Member field */
  operatorName: string
  /** Customer's full legal name, pre-fills the "I, ___" field */
  participantName: string
  /** ISO date string, e.g. "1990-01-15". Used to show guardian section. */
  dateOfBirth: string
  onComplete: (data: WaiverData) => void
  onBack?: () => void
  /** Disable submission (e.g. parent is submitting) */
  submitting?: boolean
  /** ISO date string for the first dive session.
   * Used for accurate under-18 check (age at dive start, not today). */
  bookingStartDate?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const todayLocal = () => toISODateString(new Date())

// ── Scrollable legal block ───────────────────────────────────────────────────

function LegalBlock({ text }: { text: string }) {
  return (
    <div
      className="rounded-theme p-3 text-body leading-relaxed overflow-y-auto text-secondary glass"
      style={{ maxHeight: 140, whiteSpace: 'pre-wrap' }}
    >
      {text}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

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

  /** Check coverage on the participant signature pad after each stroke. */
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

  /** Check coverage on the guardian signature pad after each stroke. */
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
      {/* Section: Non-Agency Disclosure */}
      <Card padding="md">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-accent" />
            <h2 className="text-base font-semibold font-heading">
              Non-Agency Disclosure
            </h2>
          </div>

          <div>
            <p className={`${labelClass} text-secondary`}>
              PADI Member / Store / Resort Name
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

      {/* Section: Liability Release */}
      <Card padding="md">
        <div className="space-y-3">
          <h2 className="text-base font-semibold font-heading">
            Release of Liability / Assumption of Risk
          </h2>

          <p className="text-body text-secondary">
            {tPortal('agreeTo', { name: participantName })}
          </p>

          <LegalBlock
            text={LIABILITY_RELEASE_TEXT.replace(/_____________/g, operatorName)}
          />

          {/* Acknowledgment checkbox */}
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

      {/* Section: Diver Accident Insurance */}
      <Card padding="md">
        <div className="space-y-3">
          <h2 className="text-base font-semibold font-heading">
            Diver Accident Insurance
          </h2>
          <p className="text-body text-secondary">
            Do you have diver accident insurance?
          </p>
          <div className="flex gap-6">
            {(['yes', 'no'] as const).map((val) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input /* design-ok: Batch 5 will replace with RadioGroup */
                  type="radio"
                  name="hasInsurance"
                  value={val}
                  checked={hasInsurance === val}
                  onChange={() => {
                    setHasInsurance(val)
                    clearError('hasInsurance')
                  }}
                  className="h-4 w-4 cursor-pointer"
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <span
                  className="text-body capitalize text-primary"
                >
                  {val === 'yes' ? tCommon('yes') : tCommon('no')}
                </span>
              </label>
            ))}
          </div>

          {errors.hasInsurance && (
            <InlineError>{errors.hasInsurance}</InlineError>
          )}

          {hasInsurance === 'yes' && (
            <Input
              label="Policy Number"
              value={insurancePolicyNumber}
              onChange={(e) => {
                setInsurancePolicyNumber(e.target.value)
                if (e.target.value.trim()) clearError('insurancePolicyNumber')
              }}
              placeholder="DAN-123456"
              error={errors.insurancePolicyNumber}
            />
          )}
        </div>
      </Card>

      {/* Section: Participant Signature */}
      <Card padding="md">
        <div className="space-y-4">
          <h2 className="text-base font-semibold font-heading">
            Participant Signature
          </h2>

          <SignaturePad
            ref={signatureRef}
            label="Signature"
            onChange={(has) => {
              // On clear, immediately reset. On draw, defer to onDrawEnd coverage check.
              if (!has) setHasSig(false)
            }}
            onDrawEnd={validateSignatureCoverage}
            error={errors.signature}
          />

          <Input
            type="date"
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.date}
            max={todayLocal()}
          />
        </div>
      </Card>

      {/* Section: Guardian (under-18 only) */}
      {isUnder18 && (
        <Card padding="md">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold font-heading">
                Parent / Guardian Signature
              </h2>
              <p className="text-body mt-1 text-secondary">
                {tPortal('guardianReason')}
              </p>
            </div>

            <Input
              label="Parent / Guardian Full Name"
              value={guardianName}
              onChange={(e) => {
                setGuardianName(e.target.value)
                if (e.target.value.trim()) clearError('guardianName')
              }}
              placeholder="Legal name"
              error={errors.guardianName}
            />

            <SignaturePad
              ref={guardianSignatureRef}
              label="Guardian Signature"
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
