'use client'

import { X, Anchor, Waves, Droplets } from 'lucide-react'
import { GlassCard, GlassInput } from '@/components/glass'
import type { DayConfig, WizardAction, DiveSlot } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'
import { getCourseByCode } from '@/lib/constants/course-catalog'
import type { CourseCode } from '@/lib/constants/course-catalog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayRowProps {
  day: DayConfig
  dayIndex: number
  dayNumber: number
  dispatch: Dispatch<WizardAction>
  canRemove?: boolean
  /** Customer names for labeling dive pills — e.g. ["Anna", "Bob"] */
  customerNames?: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function deriveDayLabel(day: DayConfig): string {
  if (day.venueType === 'pool') return 'Confined Water'
  if (day.venueType === 'shore') return 'Shore Dive'
  return 'Boat Dive'
}

const VENUE_ICONS = {
  boat: Anchor,
  shore: Waves,
  pool: Droplets,
} as const

const VENUE_LABELS = {
  boat: 'Boat',
  shore: 'Shore',
  pool: 'Pool',
} as const

// ── DivePill ────────────────────────────────────────────────────────────────

function DivePill({
  slot,
  active,
  onToggle,
  customerName,
}: {
  slot: DiveSlot
  active: boolean
  onToggle: () => void
  customerName?: string
}) {
  const label = slot.isConfined
    ? `${slot.courseCode} C`
    : `${slot.courseCode} ${slot.diveNumber}`

  const displayLabel = customerName
    ? `${label} (${customerName})`
    : label

  return (
    <button
      type="button"
      onClick={onToggle}
      title={getCourseByCode(slot.courseCode as CourseCode)?.name ?? slot.courseCode}
      className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors"
      style={{
        background: active
          ? 'var(--color-accent)'
          : 'var(--color-glass-bg)',
        color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
        border: `1px solid ${active ? 'transparent' : 'var(--color-glass-border)'}`,
        fontFamily: 'var(--font-body)',
      }}
    >
      {displayLabel}
    </button>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function DayRow({
  day,
  dayIndex,
  dayNumber,
  dispatch,
  canRemove = false,
  customerNames = [],
}: DayRowProps) {
  function handleVenueTypeChange(venueType: 'boat' | 'shore' | 'pool') {
    dispatch({
      type: 'UPDATE_DAY',
      dayIndex,
      patch: { venueType, inventoryUnitId: '', externalVenueName: '', poolInventoryUnitId: '', externalPoolName: '' },
    })
  }

  function handleDiveToggle(slot: DiveSlot) {
    dispatch({ type: 'TOGGLE_DIVE', dayIndex, slot })
  }

  return (
    <GlassCard padding="sm" elevated>
      {/* Header */}
      <div
        className="flex items-center justify-between pb-2 mb-2 border-b"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-heading)' }}
          >
            Day {dayNumber}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
            {formatDate(day.date)}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{
              background: 'var(--color-glass-bg)',
              border: '1px solid var(--color-glass-border)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {deriveDayLabel(day)}
          </span>
          {day.isAutoAppended && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent)',
                color: 'var(--color-warning, #f59e0b)',
              }}
            >
              Auto-added
            </span>
          )}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_DAY', dayIndex })}
            className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-destructive)' }}
            title="Remove day"
            aria-label={`Remove day ${dayNumber}`}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Venue type toggle */}
      <div className="flex gap-1 mb-3">
        {(['pool', 'boat', 'shore'] as const).map((vt) => {
          const Icon = VENUE_ICONS[vt]
          const active = day.venueType === vt
          return (
            <button
              key={vt}
              type="button"
              onClick={() => handleVenueTypeChange(vt)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors border"
              style={{
                background: active ? 'var(--color-accent)' : 'var(--color-glass-bg)',
                color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                borderColor: active ? 'transparent' : 'var(--color-glass-border)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <Icon size={11} />
              {VENUE_LABELS[vt]}
            </button>
          )
        })}
      </div>

      {/* Time fields */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <GlassInput
          label="Start time"
          type="time"
          value={day.startTime}
          onChange={(e) => dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { startTime: e.target.value } })}
        />
        <GlassInput
          label="End time"
          type="time"
          value={day.endTime}
          onChange={(e) => dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { endTime: e.target.value } })}
        />
      </div>

      {/* Dive pills (interactive toggle) */}
      {day.dives.length > 0 && (
        <div
          className="flex flex-wrap gap-1 pt-3 border-t"
          style={{ borderColor: 'var(--color-glass-border)' }}
        >
          {day.dives.map((slot, i) => (
            <DivePill
              key={`${slot.courseCode}-${slot.diveNumber}-${slot.isConfined}-${i}`}
              slot={slot}
              active={true}
              onToggle={() => handleDiveToggle(slot)}
              customerName={customerNames[0]}
            />
          ))}
        </div>
      )}

      {day.dives.length === 0 && (
        <p
          className="text-xs text-center py-2"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          No dives scheduled
        </p>
      )}
    </GlassCard>
  )
}
