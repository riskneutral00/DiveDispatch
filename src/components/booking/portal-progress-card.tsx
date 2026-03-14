'use client'

import { CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import type { BookingDetailCustomerProfile } from '../../../convex/bookings'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PortalProgressCardProps {
  portalContact: boolean
  portalMedical: boolean
  portalWaiver: boolean
  customerFormComplete: boolean
  customerProfiles: BookingDetailCustomerProfile[]
}

interface StepRowProps {
  label: string
  required: boolean
  complete: boolean
}

// ── Step row ───────────────────────────────────────────────────────────────────

function StepRow({ label, required, complete }: StepRowProps) {
  const icon = complete ? (
    <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
  ) : required ? (
    <Circle size={16} style={{ color: 'var(--color-text-secondary)' }} />
  ) : (
    <AlertCircle size={16} style={{ color: 'var(--color-text-secondary)', opacity: 0.4 }} />
  )

  return (
    <div className="flex items-center gap-3">
      {icon}
      <span
        className="text-sm flex-1"
        style={{
          color: complete ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          opacity: !required && !complete ? 0.5 : 1,
        }}
      >
        {label}
        {!required && (
          <span className="text-xs ml-1" style={{ color: 'var(--color-text-secondary)' }}>
            (not required)
          </span>
        )}
      </span>
      {complete && (
        <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>
          Done
        </span>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PortalProgressCard({
  portalContact,
  portalMedical,
  portalWaiver,
  customerFormComplete,
  customerProfiles,
}: PortalProgressCardProps) {
  const submittedCount = customerProfiles.filter((p) => p.submittedAt != null).length
  const totalProfiles = customerProfiles.length

  return (
    <div className="space-y-3">
      {/* Overall status */}
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {totalProfiles > 0
            ? `${submittedCount} / ${totalProfiles} submitted`
            : 'No portal submissions yet'}
        </span>
        {customerFormComplete && (
          <span
            className="text-xs font-semibold"
            style={{ color: 'var(--color-success)' }}
          >
            Complete
          </span>
        )}
      </div>

      {/* Step checklist */}
      <div className="space-y-2 pt-1">
        <StepRow label="Contact information" required={portalContact} complete={portalContact} />
        <StepRow label="Medical questionnaire" required={portalMedical} complete={portalMedical} />
        <StepRow label="Waiver & signature" required={portalWaiver} complete={portalWaiver} />
      </div>

      {/* Per-diver submission progress */}
      {customerProfiles.length > 0 && (
        <div className="pt-2" style={{ borderTop: '1px solid var(--color-glass-border)' }}>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Diver submissions
          </p>
          <div className="space-y-1">
            {customerProfiles.map((profile, i) => {
              const submitted = profile.submittedAt != null
              return (
                <div key={profile._id} className="flex items-center gap-2 text-sm">
                  {submitted ? (
                    <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />
                  ) : (
                    <Circle size={14} style={{ color: 'var(--color-text-secondary)' }} />
                  )}
                  <span style={{ color: 'var(--color-text-primary)' }}>Diver {i + 1}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }} className="text-xs">
                    {submitted
                      ? `Submitted ${new Date(profile.submittedAt!).toLocaleDateString()}`
                      : profile.waiverSignedAt
                        ? 'Waiver signed'
                        : 'Pending'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
