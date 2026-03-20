'use client'

import { X, Anchor, Waves, Droplets, ChevronDown } from 'lucide-react'
import { GlassCard, GlassInput } from '@/components/glass'
import type { DayConfig, WizardAction, DiveSlot } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'
import { getCourseByCode } from '@/lib/constants/course-catalog'
import type { CourseCode } from '@/lib/constants/course-catalog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResourceOption {
  id: string
  label: string
}

interface DayRowProps {
  day: DayConfig
  dayIndex: number
  dayNumber: number
  dispatch: Dispatch<WizardAction>
  canRemove?: boolean
  /** Customer names for labeling dive pills — e.g. ["Anna", "Bob"] */
  customerNames?: string[]
  /** All dives eligible for this day (active + ghost). When provided, pills persist as ghosts. */
  availableDives?: DiveSlot[]
  /** Cascade-aware toggle handler. When provided, replaces the default TOGGLE_DIVE dispatch. */
  onToggleDive?: (dayIndex: number, slot: DiveSlot) => void
  /** Instructor options for inline picker */
  instructorOptions?: ResourceOption[]
  /** Boat options for inline picker */
  boatOptions?: ResourceOption[]
  /** Pool options for inline picker */
  poolOptions?: ResourceOption[]
  /** Total number of days (for "use for remaining" button visibility) */
  totalDays?: number
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

// ── SelectField ─────────────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: ResourceOption[]
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-xs font-medium"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
      >
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="glass glass-field w-full text-sm py-2 pl-3 pr-8 appearance-none"
          style={{ color: value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          <option value="">{placeholder}</option>
          <option value="__external__">External (not in system)</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }} />
      </div>
    </div>
  )
}

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
        border: `1px ${active ? 'solid' : 'dashed'} ${active ? 'transparent' : 'var(--color-glass-border)'}`,
        opacity: active ? 1 : 0.5,
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
  availableDives,
  onToggleDive,
  instructorOptions = [],
  boatOptions = [],
  poolOptions = [],
  totalDays = 1,
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

      {/* Inline resource pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {/* Instructor */}
        <div className="flex flex-col gap-1">
          {day.instructorSlug === '__external__' ? (
            <>
              <GlassInput
                label="Instructor (external)"
                value={day.externalInstructorName ?? ''}
                onChange={(e) =>
                  dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { externalInstructorName: e.target.value } })
                }
                placeholder="Instructor name"
              />
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'SET_DAY_INSTRUCTOR', dayIndex, slug: '' })
                  dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { externalInstructorName: '' } })
                }}
                className="text-xs underline underline-offset-2 text-left"
                style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
              >
                Switch to system instructor
              </button>
            </>
          ) : (
            <>
              <SelectField
                label="Instructor"
                value={day.instructorSlug ?? ''}
                onChange={(v) => dispatch({ type: 'SET_DAY_INSTRUCTOR', dayIndex, slug: v })}
                options={instructorOptions}
                placeholder="Select instructor…"
              />
              {day.instructorSlug && dayIndex < totalDays - 1 && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'APPLY_INSTRUCTOR_TO_REMAINING', fromDayIndex: dayIndex, slug: day.instructorSlug! })}
                  className="text-xs text-left"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  → Use for remaining days
                </button>
              )}
            </>
          )}
        </div>

        {/* Venue (hidden for shore) */}
        {day.venueType !== 'shore' && (() => {
          const isPool = day.venueType === 'pool'
          const currentId = isPool ? (day.poolInventoryUnitId ?? '') : (day.inventoryUnitId ?? '')
          const externalName = isPool ? (day.externalPoolName ?? '') : (day.externalVenueName ?? '')
          const isExternal = currentId === '__external__'
          const options = isPool ? poolOptions : boatOptions
          const venueLabel = isPool ? 'Pool' : 'Boat'
          return (
            <div className="flex flex-col gap-1">
              {isExternal ? (
                <>
                  <GlassInput
                    label={`${venueLabel} (external)`}
                    value={externalName}
                    onChange={(e) => {
                      const patch = isPool
                        ? { externalPoolName: e.target.value }
                        : { externalVenueName: e.target.value }
                      dispatch({ type: 'UPDATE_DAY', dayIndex, patch })
                    }}
                    placeholder={`${venueLabel} name`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const patch = isPool
                        ? { poolInventoryUnitId: '', externalPoolName: '' }
                        : { inventoryUnitId: '', externalVenueName: '' }
                      dispatch({ type: 'UPDATE_DAY', dayIndex, patch })
                    }}
                    className="text-xs underline underline-offset-2 text-left"
                    style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
                  >
                    Switch to system {venueLabel.toLowerCase()}
                  </button>
                </>
              ) : (
                <>
                  <SelectField
                    label={venueLabel}
                    value={currentId}
                    onChange={(v) => {
                      const patch = isPool
                        ? { poolInventoryUnitId: v, externalPoolName: '' }
                        : { inventoryUnitId: v, externalVenueName: '' }
                      dispatch({ type: 'UPDATE_DAY', dayIndex, patch })
                    }}
                    options={options}
                    placeholder={`Select ${venueLabel.toLowerCase()}…`}
                  />
                  {currentId && dayIndex < totalDays - 1 && (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'APPLY_VENUE_TO_REMAINING', fromDayIndex: dayIndex, unitId: currentId })}
                      className="text-xs text-left"
                      style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                    >
                      → Use for remaining {day.venueType} days
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })()}
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

      {/* Dive pills (interactive toggle — ghost pills for available-but-unassigned) */}
      {(() => {
        const displaySlots = availableDives ?? day.dives
        if (displaySlots.length === 0) {
          return (
            <p
              className="text-xs text-center py-2"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              No dives scheduled
            </p>
          )
        }
        return (
          <div
            className="flex flex-wrap gap-1 pt-3 border-t"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            {displaySlots.map((slot, i) => {
              const isActive = day.dives.some(
                (d) => d.courseCode === slot.courseCode && d.diveNumber === slot.diveNumber && d.isConfined === slot.isConfined,
              )
              return (
                <DivePill
                  key={`${slot.courseCode}-${slot.diveNumber}-${slot.isConfined}-${i}`}
                  slot={slot}
                  active={isActive}
                  onToggle={() =>
                    onToggleDive
                      ? onToggleDive(dayIndex, { courseCode: slot.courseCode, diveNumber: slot.diveNumber, isConfined: slot.isConfined })
                      : handleDiveToggle({ courseCode: slot.courseCode, diveNumber: slot.diveNumber, isConfined: slot.isConfined })
                  }
                  customerName={customerNames[0]}
                />
              )
            })}
          </div>
        )
      })()}
    </GlassCard>
  )
}
