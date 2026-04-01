'use client'

import React, { useCallback, useRef, useState } from 'react'
import { GlassCard } from '../ui/glass-card'
import { GlassCheckbox } from '../ui/glass-checkbox'
import { GlassInput } from '../ui/glass-input'
import { SignaturePad, SignaturePadHandle } from './signature-pad'
import { ShieldCheck } from 'lucide-react'
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Scrollable legal block ───────────────────────────────────────────────────

function LegalBlock({ text }: { text: string }) {
  return (
    <div
      className="rounded-[var(--border-radius)] p-3 text-xs leading-relaxed overflow-y-auto text-secondary"
      style={{ background: 'var(--color-glass-bg)',
        border: '1px solid var(--color-glass-border)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        maxHeight: 140,
        whiteSpace: 'pre-wrap' }}
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
  const refDate = bookingStartDate ?? todayISO()
  const isUnder18 = dateOfBirth ? calcAgeAtDate(dateOfBirth, refDate) < 18 : false

  const [acknowledged, setAcknowledged] = useState(false)
  const [hasInsurance, setHasInsurance] = useState<'yes' | 'no' | null>(null)
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('')
  const [date, setDate] = useState(todayISO())
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
    if (!acknowledged) next.acknowledged = 'You must acknowledge the agreement.'
    if (!hasSig) next.signature = 'Participant signature is required.'
    if (!date) next.date = 'Date is required.'
    if (hasInsurance === null) next.hasInsurance = 'Please indicate whether you have diver accident insurance.'
    if (hasInsurance === 'yes' && !insurancePolicyNumber.trim()) {
      next.insurancePolicyNumber = 'Policy number is required.'
    }
    if (isUnder18) {
      if (!guardianName.trim()) next.guardianName = 'Guardian name is required.'
      if (!hasGuardianSig) next.guardianSignature = 'Guardian signature is required.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const signatureBlob = await signatureRef.current?.getBlob()
    if (!signatureBlob) {
      setErrors({ ...errors, signature: 'Participant signature is required.' })
      return
    }

    let guardianSignatureBlob: Blob | undefined
    if (isUnder18) {
      const blob = await guardianSignatureRef.current?.getBlob()
      if (!blob) {
        setErrors({ ...errors, guardianSignature: 'Guardian signature is required.' })
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

  const labelClass = 'text-sm font-medium'
  const sectionHeadingStyle: React.CSSProperties = {
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-heading)',
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Section: Non-Agency Disclosure */}
      <GlassCard padding="md">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-base font-semibold" style={sectionHeadingStyle}>
              Non-Agency Disclosure
            </h2>
          </div>

          <div>
            <p className={`${labelClass} text-secondary`}>
              PADI Member / Store / Resort Name
            </p>
            <p
              className="mt-1 text-sm font-medium text-primary"
            >
              {operatorName}
            </p>
          </div>

          <LegalBlock
            text={NON_AGENCY_DISCLOSURE.replace(/____________/g, operatorName)}
          />
        </div>
      </GlassCard>

      {/* Section: Liability Release */}
      <GlassCard padding="md">
        <div className="space-y-3">
          <h2 className="text-base font-semibold" style={sectionHeadingStyle}>
            Release of Liability / Assumption of Risk
          </h2>

          <p className="text-sm text-secondary">
            I,{' '}
            <span
              className="font-semibold text-primary"
            >
              {participantName}
            </span>
            , agree to the following:
          </p>

          <LegalBlock
            text={LIABILITY_RELEASE_TEXT.replace(/_____________/g, operatorName)}
          />

          {/* Acknowledgment checkbox */}
          <GlassCheckbox
            label={
              <span className="text-sm leading-snug text-secondary">
                I have read and fully understand this Release of Liability / Assumption of Risk
                Agreement. I am of lawful age and legally competent to sign it of my own free act.
              </span>
            }
            checked={acknowledged}
            onChange={(v) => {
              setAcknowledged(v)
              if (v) clearError('acknowledged')
            }}
          />
          {errors.acknowledged && (
            <p className="text-sm" style={{ color: 'var(--color-destructive)' }} role="alert">
              {errors.acknowledged}
            </p>
          )}
        </div>
      </GlassCard>

      {/* Section: Diver Accident Insurance */}
      <GlassCard padding="md">
        <div className="space-y-3">
          <h2 className="text-base font-semibold" style={sectionHeadingStyle}>
            Diver Accident Insurance
          </h2>
          <p className="text-sm text-secondary">
            Do you have diver accident insurance?
          </p>
          <div className="flex gap-6">
            {(['yes', 'no'] as const).map((val) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input
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
                  className="text-sm capitalize text-primary"
                >
                  {val === 'yes' ? 'Yes' : 'No'}
                </span>
              </label>
            ))}
          </div>

          {errors.hasInsurance && (
            <p className="text-sm" style={{ color: 'var(--color-destructive)' }} role="alert">
              {errors.hasInsurance}
            </p>
          )}

          {hasInsurance === 'yes' && (
            <GlassInput
              label="Policy Number"
              value={insurancePolicyNumber}
              onChange={(e) => {
                setInsurancePolicyNumber(e.target.value)
                if (e.target.value.trim()) clearError('insurancePolicyNumber')
              }}
              placeholder="e.g. DAN-123456"
              error={errors.insurancePolicyNumber}
            />
          )}
        </div>
      </GlassCard>

      {/* Section: Participant Signature */}
      <GlassCard padding="md">
        <div className="space-y-4">
          <h2 className="text-base font-semibold" style={sectionHeadingStyle}>
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

          <GlassInput
            type="date"
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.date}
            max={todayISO()}
          />
        </div>
      </GlassCard>

      {/* Section: Guardian (under-18 only) */}
      {isUnder18 && (
        <GlassCard padding="md">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold" style={sectionHeadingStyle}>
                Parent / Guardian Signature
              </h2>
              <p className="text-sm mt-1 text-secondary">
                Required because the participant is under 18 years of age.
              </p>
            </div>

            <GlassInput
              label="Parent / Guardian Full Name"
              value={guardianName}
              onChange={(e) => {
                setGuardianName(e.target.value)
                if (e.target.value.trim()) clearError('guardianName')
              }}
              placeholder="Full legal name"
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
        </GlassCard>
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
