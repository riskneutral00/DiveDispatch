'use client'

import { useState, useEffect, useRef } from 'react'
import { Calendar, RefreshCw, AlertCircle } from 'lucide-react'
import { GlassCard, GlassButton } from '@/components/glass'
import { DaySchedule } from './day-schedule'
import {
  buildScheduledSessions,
  toSessionEntries,
  getDatesInRange,
  getDeliveryLocation,
  type ScheduledSession,
  type Venue,
} from '@/lib/booking/session-builder'
import type {
  DetailsState,
  DiverEntry,
  ResourcesState,
  SessionEntry,
  WizardAction,
} from '@/lib/booking/wizard-state'
import { bookingSessionsSchema } from '@/lib/validation/bookingSchemas'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StepSessionsProps {
  sessions: SessionEntry[]
  details: DetailsState
  divers: DiverEntry[]
  resources: ResourcesState
  dispatch: React.Dispatch<WizardAction>
  onValidityChange?: (valid: boolean) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Rebuild rich sessions from course rules, preserving any user-edited times from
// the lean wizard state sessions (same date → keep startTime/endTime/timezone).
function rebuildWithPreservedTimes(
  details: DetailsState,
  divers: DiverEntry[],
  resources: ResourcesState,
  saved: SessionEntry[],
): ScheduledSession[] {
  const fresh = buildScheduledSessions(details, divers, resources)
  if (saved.length === 0) return fresh

  return fresh.map(s => {
    const match = saved.find(ss => ss.date === s.date)
    if (!match) return s
    return {
      ...s,
      startTime: match.startTime,
      endTime: match.endTime,
      timezone: match.timezone,
      // Preserve venue choice for non-confined days when navigating back/forward
      ...(!s.isConfinedDay ? { deliveryLocation: match.deliveryLocation } : {}),
    }
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StepSessions({
  sessions,
  details,
  divers,
  resources,
  dispatch,
  onValidityChange,
}: StepSessionsProps) {
  const [richSessions, setRichSessions] = useState<ScheduledSession[]>(() =>
    rebuildWithPreservedTimes(details, divers, resources, sessions),
  )

  // Notify parent when validity changes
  useEffect(() => {
    if (!onValidityChange) return
    onValidityChange(bookingSessionsSchema.safeParse(sessions).success)
  }, [sessions, onValidityChange])

  // Sync lean entries to wizard state on first mount and on every user edit.
  // dispatch is stable from useReducer — safe in the dep array.
  const syncedRef = useRef(false)
  useEffect(() => {
    if (!syncedRef.current) {
      // On mount: push initial sessions into wizard state so back/forward is preserved.
      syncedRef.current = true
      dispatch({ type: 'SET_SESSIONS', payload: toSessionEntries(richSessions) })
    }
  }, [richSessions, dispatch])

  function handleRebuild() {
    const rebuilt = buildScheduledSessions(details, divers, resources)
    setRichSessions(rebuilt)
    dispatch({ type: 'SET_SESSIONS', payload: toSessionEntries(rebuilt) })
  }

  function handleVenueChange(globalIndex: number, venue: Venue) {
    setRichSessions(prev => {
      const next = prev.map((s, i) =>
        i === globalIndex
          ? { ...s, deliveryLocation: getDeliveryLocation(s.isConfinedDay, venue) }
          : s,
      )
      dispatch({ type: 'SET_SESSIONS', payload: toSessionEntries(next) })
      return next
    })
  }

  function handleUpdate(
    globalIndex: number,
    field: 'startTime' | 'endTime' | 'timezone',
    value: string,
  ) {
    setRichSessions(prev => {
      const next = prev.map((s, i) => (i === globalIndex ? { ...s, [field]: value } : s))
      dispatch({ type: 'SET_SESSIONS', payload: toSessionEntries(next) })
      return next
    })
  }

  const dates = getDatesInRange(details.startDate, details.endDate)

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar size={16} style={{ color: 'var(--color-accent)' }} />
          <span
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            {dates.length} day{dates.length !== 1 ? 's' : ''} &middot; {richSessions.length}{' '}
            session{richSessions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <GlassButton variant="secondary" size="sm" onClick={handleRebuild}>
          <RefreshCw size={13} />
          Regenerate
        </GlassButton>
      </div>

      {/* Empty state: no date range */}
      {dates.length === 0 && (
        <GlassCard padding="md" className="text-center">
          <AlertCircle
            size={22}
            className="mx-auto mb-2"
            style={{ color: 'var(--color-warning)' }}
          />
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            Set start and end dates in the Details step to generate sessions.
          </p>
        </GlassCard>
      )}

      {/* Empty state: no divers */}
      {dates.length > 0 && divers.length === 0 && (
        <GlassCard padding="md" className="text-center">
          <AlertCircle
            size={22}
            className="mx-auto mb-2"
            style={{ color: 'var(--color-warning)' }}
          />
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            Add divers with course selections in the Divers step to schedule sessions.
          </p>
        </GlassCard>
      )}

      {/* Day schedule list */}
      {dates.map((date, dayIndex) => {
        // Collect sessions for this date with their global indices.
        const daySessions: Array<{ session: ScheduledSession; globalIndex: number }> =
          richSessions.reduce<Array<{ session: ScheduledSession; globalIndex: number }>>(
            (acc, s, i) => {
              if (s.date === date) acc.push({ session: s, globalIndex: i })
              return acc
            },
            [],
          )

        return (
          <DaySchedule
            key={date}
            date={date}
            dayNumber={dayIndex + 1}
            sessions={daySessions.map(x => x.session)}
            onUpdate={(idxInDay, field, value) =>
              handleUpdate(daySessions[idxInDay].globalIndex, field, value)
            }
            onVenueChange={(idxInDay, venue) =>
              handleVenueChange(daySessions[idxInDay].globalIndex, venue)
            }
          />
        )
      })}
    </div>
  )
}
