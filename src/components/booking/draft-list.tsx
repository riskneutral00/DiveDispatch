'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation } from 'convex/react'
import { Calendar, Clock, Users, ChevronRight, Trash2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { GlassCard, GlassBadge, GlassButton, GlassDialog } from '@/components/glass'
import { useStableQuery } from '@/lib/hooks/use-stable-query'
import { WIZARD_STEP_LABELS, WIZARD_STEPS } from '@/lib/booking/wizard-state'
import type { WizardStep } from '@/lib/booking/wizard-state'
import type { Id } from '../../../convex/_generated/dataModel'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseStepLabel(draftState: string): string {
  try {
    const parsed = JSON.parse(draftState) as { step?: WizardStep }
    const step = parsed.step
    if (step && WIZARD_STEP_LABELS[step]) {
      const index = WIZARD_STEPS.indexOf(step)
      return `Step ${index + 1}: ${WIZARD_STEP_LABELS[step]}`
    }
  } catch {
    // corrupted state — fall through to default
  }
  return 'Unknown progress'
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DraftList() {
  const [discardId, setDiscardId] = useState<string | null>(null)
  const [isDiscarding, setIsDiscarding] = useState(false)

  const { data, isLoading } = useStableQuery(api.bookingDraftMutations.listResumableDrafts, {})
  const discardDraft = useMutation(api.bookingDraftMutations.discardDraft)

  if (isLoading || !data || data.drafts.length === 0) return null

  async function handleDiscard() {
    if (!discardId) return
    setIsDiscarding(true)
    try {
      await discardDraft({ bookingId: discardId as Id<'bookings'> })
      setDiscardId(null)
    } finally {
      setIsDiscarding(false)
    }
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-base font-semibold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            In-Progress Drafts
          </h2>
          {data.hasMore && (
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Showing 5 of more
            </span>
          )}
        </div>

        {/* Mobile: horizontal scroll; desktop: auto-flow grid */}
        <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-x-visible">
          {data.drafts.map((draft) => {
            const stepLabel = parseStepLabel(draft.draftState)
            const activities = draft.activityType.length > 0
              ? draft.activityType.join(', ')
              : 'No activity yet'
            const dateRange =
              draft.startDate !== draft.endDate
                ? `${draft.startDate} – ${draft.endDate}`
                : draft.startDate

            return (
              <div key={draft._id} className="relative flex-shrink-0 w-64 sm:w-auto">
                <Link href={`/booking/${draft._id}/edit`}>
                  <GlassCard padding="sm" hoverable>
                    <div className="space-y-2 pr-5">
                      <div className="flex items-start gap-2">
                        <p
                          className="text-sm font-medium flex-1 truncate"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {activities}
                        </p>
                        <ChevronRight
                          size={14}
                          className="flex-shrink-0 mt-0.5"
                          style={{ color: 'var(--color-text-secondary)' }}
                        />
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span
                          className="flex items-center gap-1 text-xs"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          <Calendar size={11} />
                          {dateRange}
                        </span>
                        {draft.diverCount > 0 && (
                          <span
                            className="flex items-center gap-1 text-xs"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            <Users size={11} />
                            {draft.diverCount}
                          </span>
                        )}
                      </div>

                      <GlassBadge variant="default" size="sm">
                        {stepLabel}
                      </GlassBadge>

                      <p
                        className="flex items-center gap-1 text-xs"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <Clock size={11} />
                        {formatRelativeTime(draft._creationTime)}
                      </p>
                    </div>
                  </GlassCard>
                </Link>

                {/* Discard button — outside the Link to avoid triggering navigation */}
                <button
                  onClick={() => setDiscardId(draft._id)}
                  className="absolute top-2 right-2 p-1 rounded opacity-50 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-label="Discard draft"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <GlassDialog
        open={discardId !== null}
        onClose={() => setDiscardId(null)}
        title="Discard draft?"
        size="sm"
      >
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          This will permanently delete the in-progress booking. Any held inventory will be released.
        </p>
        <div className="flex justify-end gap-2">
          <GlassButton
            size="sm"
            variant="secondary"
            onClick={() => setDiscardId(null)}
            disabled={isDiscarding}
          >
            Cancel
          </GlassButton>
          <GlassButton
            size="sm"
            variant="destructive"
            onClick={handleDiscard}
            disabled={isDiscarding}
          >
            {isDiscarding ? 'Discarding…' : 'Discard'}
          </GlassButton>
        </div>
      </GlassDialog>
    </>
  )
}
