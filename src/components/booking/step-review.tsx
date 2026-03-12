'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { ChevronLeft, Send, AlertTriangle, Calendar, Users, Briefcase } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { GlassCard, GlassButton } from '@/components/glass'
import type { WizardState, WizardAction } from '@/lib/booking/wizard-state'
import { WIZARD_STEPS } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StepReviewProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string): string {
  if (start === end) return start
  return `${start} – ${end}`
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-wider mb-2"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {children}
    </p>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StepReview({ state, dispatch }: StepReviewProps) {
  const router = useRouter()
  const submitToDraft = useMutation(api.bookingsMutations.submitToDraft)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { details, divers, resources, sessions, bookingId } = state

  const resourceIndex = WIZARD_STEPS.indexOf('resources')

  function handleBack() {
    dispatch({ type: 'SET_STEP', payload: 'sessions' })
  }

  async function handleSubmit() {
    if (!bookingId) return
    setSubmitError(null)
    setSubmitting(true)

    try {
      await submitToDraft({
        bookingId: bookingId as Id<'bookings'>,
        sessions: sessions.map((s) => ({
          inventoryUnitId: s.inventoryUnitId as Id<'inventoryUnits'>,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          timezone: s.timezone,
          unitsRequested: s.unitsRequested,
          deliveryLocation: s.deliveryLocation,
        })),
      })
      // Redirect to dashboard after successful submission
      router.push('/dashboard')
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { code?: string; reason?: string }
        if (data.code === 'CONFLICT') {
          setSubmitError(
            data.reason
              ? `Availability conflict: ${data.reason}`
              : 'A resource is unavailable for one or more of your selected dates. Please go back and adjust your session schedule.',
          )
        } else if (data.code === 'BLOCKED_DATE') {
          setSubmitError('One of the selected dates is blocked. Please adjust your session dates.')
        } else {
          setSubmitError(data.reason ?? data.code ?? 'Submission failed. Please try again.')
        }
      } else {
        setSubmitError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Resource display helpers ─────────────────────────────────────────────

  const ext = resources.externalStakeholders ?? {}

  function resourceLine(inSystem: string | undefined, external: string | undefined): string | null {
    if (inSystem) return inSystem
    if (external) return `External: ${external}`
    return null
  }

  const instructor = resourceLine(resources.instructorId, ext.instructorName)
  const boat = resourceLine(resources.boatId, ext.boatName)
  const equipment = resourceLine(resources.equipmentManagerId, ext.equipmentManagerName)
  const pool = resourceLine(resources.poolId, ext.poolName)
  const compressor = resourceLine(resources.compressorId, ext.compressorName)

  const hasAnyResource = instructor ?? boat ?? equipment ?? pool ?? compressor

  return (
    <div className="flex flex-col gap-4">
      {/* ── Activity + dates ── */}
      <GlassCard padding="md" elevated>
        <SectionLabel>Booking Overview</SectionLabel>
        <div className="flex flex-col gap-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>
          <div className="flex items-center gap-2">
            <Calendar size={14} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
            <span>{formatDateRange(details.startDate, details.endDate)}</span>
          </div>
          {details.activityType.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {details.activityType.map((code) => (
                <span
                  key={code}
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                    color: 'var(--color-primary)',
                    border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
                  }}
                >
                  {code}
                </span>
              ))}
            </div>
          )}
        </div>
      </GlassCard>

      {/* ── Divers ── */}
      {divers.length > 0 && (
        <GlassCard padding="md" elevated>
          <SectionLabel>
            <span className="flex items-center gap-1.5">
              <Users size={12} />
              Divers ({divers.length})
            </span>
          </SectionLabel>
          <div className="flex flex-col gap-2">
            {divers.map((diver, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <span className="text-base leading-none select-none" aria-hidden>
                  {diver.flag.code
                    ? String.fromCodePoint(
                        ...diver.flag.code
                          .toUpperCase()
                          .split('')
                          .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
                      )
                    : '🌐'}
                </span>
                <span className="font-medium">{diver.name || `Diver ${i + 1}`}</span>
                {diver.abbrev && (
                  <span className="text-xs opacity-60">{diver.abbrev}</span>
                )}
                <span
                  className="ml-auto text-xs"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {formatDateRange(diver.startDate, diver.endDate)}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* ── Resources ── */}
      {hasAnyResource && (
        <GlassCard padding="md" elevated>
          <SectionLabel>
            <span className="flex items-center gap-1.5">
              <Briefcase size={12} />
              Resources
            </span>
          </SectionLabel>
          <div className="flex flex-col gap-1.5 text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {instructor && (
              <div className="flex justify-between gap-2">
                <span style={{ color: 'var(--color-text-secondary)' }}>Instructor</span>
                <span className="text-right">{instructor}</span>
              </div>
            )}
            {boat && (
              <div className="flex justify-between gap-2">
                <span style={{ color: 'var(--color-text-secondary)' }}>Boat</span>
                <span className="text-right">{boat}</span>
              </div>
            )}
            {equipment && (
              <div className="flex justify-between gap-2">
                <span style={{ color: 'var(--color-text-secondary)' }}>Equipment</span>
                <span className="text-right">{equipment}</span>
              </div>
            )}
            {pool && (
              <div className="flex justify-between gap-2">
                <span style={{ color: 'var(--color-text-secondary)' }}>Pool</span>
                <span className="text-right">{pool}</span>
              </div>
            )}
            {compressor && (
              <div className="flex justify-between gap-2">
                <span style={{ color: 'var(--color-text-secondary)' }}>Compressor</span>
                <span className="text-right">{compressor}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_STEP', payload: WIZARD_STEPS[resourceIndex] })}
            className="mt-3 text-xs underline underline-offset-2 focus:outline-none focus-visible:ring-2"
            style={{ color: 'var(--color-accent)' }}
          >
            Edit resources
          </button>
        </GlassCard>
      )}

      {/* ── Sessions ── */}
      {sessions.length > 0 && (
        <GlassCard padding="md" elevated>
          <SectionLabel>Sessions ({sessions.length})</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {sessions.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)' }}
                >
                  {i + 1}
                </span>
                <span>{s.date}</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {s.startTime}–{s.endTime}
                </span>
                {s.deliveryLocation && (
                  <span
                    className="ml-auto text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {s.deliveryLocation}
                  </span>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* ── Portal settings ── */}
      {(details.portalContact || details.portalMedical || details.portalWaiver) && (
        <GlassCard padding="md" elevated>
          <SectionLabel>Customer Portal Forms</SectionLabel>
          <div className="flex flex-wrap gap-2 text-xs">
            {details.portalContact && (
              <span
                className="px-2 py-0.5 rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--color-success) 15%, transparent)',
                  color: 'var(--color-success)',
                  border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
                }}
              >
                Contact
              </span>
            )}
            {details.portalMedical && (
              <span
                className="px-2 py-0.5 rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--color-success) 15%, transparent)',
                  color: 'var(--color-success)',
                  border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
                }}
              >
                Medical
              </span>
            )}
            {details.portalWaiver && (
              <span
                className="px-2 py-0.5 rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--color-success) 15%, transparent)',
                  color: 'var(--color-success)',
                  border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
                }}
              >
                Waiver
              </span>
            )}
          </div>
        </GlassCard>
      )}

      {/* ── Error ── */}
      {submitError && (
        <div
          className="flex items-start gap-3 p-3 rounded-[var(--border-radius)] text-sm"
          style={{
            background: 'color-mix(in srgb, var(--color-destructive) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-destructive) 30%, transparent)',
            color: 'var(--color-destructive)',
          }}
          role="alert"
        >
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" aria-hidden />
          <span>{submitError}</span>
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="flex justify-between items-center gap-4 mt-2">
        <GlassButton
          variant="secondary"
          onClick={handleBack}
          disabled={submitting}
          size="md"
        >
          <ChevronLeft size={16} />
          Back
        </GlassButton>

        <GlassButton
          variant="primary"
          onClick={handleSubmit}
          disabled={submitting || !bookingId || sessions.length === 0}
          loading={submitting}
          size="md"
        >
          <Send size={16} />
          Submit Booking
        </GlassButton>
      </div>

      {sessions.length === 0 && !submitting && (
        <p className="text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>
          Add sessions in the Sessions step before submitting.
        </p>
      )}
    </div>
  )
}
