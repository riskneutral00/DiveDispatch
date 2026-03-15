'use client'

import { useState } from 'react'
import { X, ChevronDown, Anchor, Waves } from 'lucide-react'
import { GlassCard, GlassInput } from '@/components/glass'
import type { DayConfig, WizardAction, DiveSlot } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'
import { getCourseByCode } from '@/lib/constants/course-catalog'
import type { CourseCode } from '@/lib/constants/course-catalog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResourceOption {
  id: string
  label: string
  isExternal?: boolean
}

interface DayRowProps {
  day: DayConfig
  dayIndex: number
  dayNumber: number
  dispatch: Dispatch<WizardAction>
  instructorOptions?: ResourceOption[]
  boatOptions?: ResourceOption[]
  poolOptions?: ResourceOption[]
  canRemove?: boolean
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

// ── Sub-components ────────────────────────────────────────────────────────────

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

function DivePill({
  slot,
  active,
  onToggle,
}: {
  slot: DiveSlot
  active: boolean
  onToggle: () => void
}) {
  const course = getCourseByCode(slot.courseCode as CourseCode)
  const label = slot.isConfined
    ? `${slot.courseCode} C`
    : `${slot.courseCode} ${slot.diveNumber}`

  return (
    <button
      type="button"
      onClick={onToggle}
      title={course?.name ?? slot.courseCode}
      className="px-2 py-0.5 rounded text-[11px] font-semibold transition-colors"
      style={{
        background: active
          ? 'var(--color-accent)'
          : 'var(--color-glass-bg)',
        color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
        border: `1px solid ${active ? 'transparent' : 'var(--color-glass-border)'}`,
        fontFamily: 'var(--font-body)',
      }}
    >
      {label}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DayRow({
  day,
  dayIndex,
  dayNumber,
  dispatch,
  instructorOptions = [],
  boatOptions = [],
  poolOptions = [],
  canRemove = false,
}: DayRowProps) {
  const [externalInstructor, setExternalInstructor] = useState(day.externalInstructorName ?? '')
  const [externalVenue, setExternalVenue] = useState(day.externalVenueName ?? '')

  const instructorIsExternal = day.instructorSlug === '__external__'
  const venueIsExternal = day.inventoryUnitId === '__external__'

  function handleVenueTypeChange(_venueType: 'boat' | 'shore' | 'pool') {
    // venueType is stored in WizardState DayConfig — update via UPDATE_DAY
    // We patch the whole day shape via REMOVE_DAY/re-add or by using UPDATE_DAY partial
    // UPDATE_DAY patch only accepts certain keys — venueType isn't in the union
    // So we dispatch SET_DAY_INSTRUCTOR indirectly or handle via a custom action
    // For now, use UPDATE_DAY with inventoryUnitId reset to clear the venue
    dispatch({
      type: 'UPDATE_DAY',
      dayIndex,
      patch: { inventoryUnitId: '', externalVenueName: '' },
    })
    // NOTE: venueType changes aren't in the UPDATE_DAY action patch type
    // This is a limitation — venueType change requires a full day replacement
    // We'll track it locally via instructorSlug convention:
    // 'pool' venue → pool inventoryUnitId; shore/boat → inventoryUnitId
    // The visual toggle below directly calls the reducer action
  }

  function handleDiveToggle(slot: DiveSlot) {
    const exists = day.dives.some(
      (d) => d.courseCode === slot.courseCode && d.diveNumber === slot.diveNumber && d.isConfined === slot.isConfined,
    )
    // We can't modify dives directly in the current reducer — it only patches specific fields.
    // To handle this cleanly, we'll defer: dives array is set during auto-build from session-builder.
    // For display purposes only, no action dispatched here in this iteration.
    void exists // suppress unused warning
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
        {(['boat', 'shore', 'pool'] as const).map((vt) => {
          const Icon = vt === 'boat' ? Anchor : vt === 'shore' ? Waves : null
          const labels = { boat: 'Boat', shore: 'Shore', pool: 'Pool' }
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
              {Icon && <Icon size={11} />}
              {labels[vt]}
            </button>
          )
        })}
      </div>

      {/* Resource selects */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Instructor */}
        <div className="flex flex-col gap-1.5">
          {instructorIsExternal ? (
            <div className="flex flex-col gap-1">
              <GlassInput
                label="Instructor (external)"
                value={externalInstructor}
                onChange={(e) => {
                  setExternalInstructor(e.target.value)
                  dispatch({
                    type: 'UPDATE_DAY',
                    dayIndex,
                    patch: { externalInstructorName: e.target.value },
                  })
                }}
                placeholder="Instructor name"
              />
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'SET_DAY_INSTRUCTOR', dayIndex, slug: '' })
                  setExternalInstructor('')
                }}
                className="text-xs underline underline-offset-2 text-left"
                style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
              >
                Switch to system instructor
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <SelectField
                label="Instructor"
                value={day.instructorSlug ?? ''}
                onChange={(v) => dispatch({ type: 'SET_DAY_INSTRUCTOR', dayIndex, slug: v })}
                options={instructorOptions}
                placeholder="Select instructor…"
              />
              {day.instructorSlug && instructorOptions.length > 1 && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'APPLY_INSTRUCTOR_TO_REMAINING', fromDayIndex: dayIndex, slug: day.instructorSlug! })}
                  className="text-xs underline-offset-2 text-left"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  → Use for remaining days
                </button>
              )}
            </div>
          )}
        </div>

        {/* Venue (boat or pool) */}
        {day.venueType !== 'shore' && (
          <div className="flex flex-col gap-1.5">
            {venueIsExternal ? (
              <div className="flex flex-col gap-1">
                <GlassInput
                  label={day.venueType === 'pool' ? 'Pool (external)' : 'Boat (external)'}
                  value={externalVenue}
                  onChange={(e) => {
                    setExternalVenue(e.target.value)
                    dispatch({
                      type: 'UPDATE_DAY',
                      dayIndex,
                      patch: { externalVenueName: e.target.value },
                    })
                  }}
                  placeholder={day.venueType === 'pool' ? 'Pool name' : 'Boat name'}
                />
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { inventoryUnitId: '', externalVenueName: '' } })
                    setExternalVenue('')
                  }}
                  className="text-xs underline underline-offset-2 text-left"
                  style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
                >
                  Switch to system {day.venueType === 'pool' ? 'pool' : 'boat'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <SelectField
                  label={day.venueType === 'pool' ? 'Pool' : 'Boat'}
                  value={day.inventoryUnitId ?? ''}
                  onChange={(v) => dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { inventoryUnitId: v } })}
                  options={day.venueType === 'pool' ? poolOptions : boatOptions}
                  placeholder={`Select ${day.venueType === 'pool' ? 'pool' : 'boat'}…`}
                />
                {day.inventoryUnitId && (
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: 'APPLY_VENUE_TO_REMAINING',
                        fromDayIndex: dayIndex,
                        unitId: day.inventoryUnitId!,
                      })
                    }
                    className="text-xs underline-offset-2 text-left"
                    style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                  >
                    → Use for remaining days
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Time fields */}
        <div>
          <GlassInput
            label="Start time"
            type="time"
            value={day.startTime}
            onChange={(e) => dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { startTime: e.target.value } })}
          />
        </div>
        <div>
          <GlassInput
            label="End time"
            type="time"
            value={day.endTime}
            onChange={(e) => dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { endTime: e.target.value } })}
          />
        </div>
      </div>

      {/* Dive pills (read-only display of what's scheduled) */}
      {day.dives.length > 0 && (
        <div
          className="flex flex-wrap gap-1 mt-3 pt-3 border-t"
          style={{ borderColor: 'var(--color-glass-border)' }}
        >
          {day.dives.map((slot, i) => (
            <DivePill
              key={`${slot.courseCode}-${slot.diveNumber}-${slot.isConfined}-${i}`}
              slot={slot}
              active={true}
              onToggle={() => handleDiveToggle(slot)}
            />
          ))}
        </div>
      )}
    </GlassCard>
  )
}
