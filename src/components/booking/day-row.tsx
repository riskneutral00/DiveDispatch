'use client'

import { X, Anchor, Waves, Droplets } from 'lucide-react'
import { GlassCard, GlassInput, GlassSelect, GlassSimpleSelect } from '@/components/glass'
import type { DayConfig, WizardAction, DiveSlot } from '@/lib/booking/wizard-state'
import type { DiveSlotDef } from '@/lib/booking/generate-days'
import { buildDiveSequence } from '@/lib/booking/generate-days'
import type { Dispatch } from 'react'
import { getCourseByCode } from '@/lib/constants/course-catalog'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { languageFlagText } from '@/components/common/language-flags'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResourceOption {
  id: string
  label: string
  languages?: string[]
}

interface DayRowProps {
  day: DayConfig
  dayIndex: number
  dayNumber: number
  dispatch: Dispatch<WizardAction>
  canRemove?: boolean
  /** All dives eligible for this day (active + ghost). When provided, pills persist as ghosts. */
  availableDives?: DiveSlotDef[]
  /** Cascade-aware toggle handler. When provided, replaces the default TOGGLE_DIVE dispatch. */
  onToggleDive?: (dayIndex: number, slot: DiveSlot) => void
  /** Instructor options for inline picker */
  instructorOptions?: ResourceOption[]
  /** Boat options for inline picker */
  boatOptions?: ResourceOption[]
  /** Pool options for inline picker */
  poolOptions?: ResourceOption[]
  /** Shore/beach options for inline picker */
  shoreOptions?: ResourceOption[]
  /** Total number of days (for "use for remaining" button visibility) */
  totalDays?: number
  /** Course codes for global dive sequence sort order */
  courseCodes?: string[]
  /** Customer language codes for instructor tier filtering */
  customerLanguages?: string[]
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

function deriveDayLabel(_day: DayConfig): string {
  return 'Dive Day'
}

/** Extracted from map-loop inline styles — one allocation, shared by all renders. */
const HEADING_FONT_STYLE: React.CSSProperties = { fontFamily: 'var(--font-heading)' }
const BODY_FONT_STYLE: React.CSSProperties = { fontFamily: 'var(--font-body)' }
const HEADER_BORDER_STYLE: React.CSSProperties = { borderColor: 'var(--color-glass-border)' }
const DAY_LABEL_STYLE: React.CSSProperties = { background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)', fontFamily: 'var(--font-body)' }
const AUTO_APPENDED_STYLE: React.CSSProperties = { background: 'color-mix(in srgb, var(--color-warning, #fbbf24) 15%, transparent)', color: 'var(--color-warning, #fbbf24)' }
const REMOVE_BTN_STYLE: React.CSSProperties = { color: 'var(--color-destructive)' }
const SWITCH_LINK_STYLE: React.CSSProperties = { color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }
const VENUE_SECTION_BORDER_STYLE: React.CSSProperties = { borderColor: 'var(--color-glass-border)' }

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
  const selectOptions = [
    { value: '__external__', label: 'External (not in system)' },
    ...options.map((opt) => ({
      value: opt.id,
      label: `${opt.label}${languageFlagText(opt.languages)}`,
    })),
  ]
  return (
    <GlassSimpleSelect
      label={label}
      value={value}
      onChange={onChange}
      options={selectOptions}
      placeholder={placeholder}
    />
  )
}

// ── DivePill ────────────────────────────────────────────────────────────────

function DivePill({
  slot,
  active,
  capped,
  onToggle,
}: {
  slot: DiveSlot
  active: boolean
  /** Day's non-confined dive limit reached — pill disabled */
  capped?: boolean
  onToggle: () => void
}) {
  const label = slot.isConfined
    ? 'Confined'
    : `${slot.courseCode} ${slot.diveNumber}`

  const isCappedAndInactive = capped && !active

  return (
    <button
      type="button"
      onClick={isCappedAndInactive ? undefined : onToggle}
      disabled={isCappedAndInactive}
      title={
        isCappedAndInactive
          ? 'Day limit reached — max 3 dives'
          : getCourseByCode(slot.courseCode as CourseCode)?.name ?? slot.courseCode
      }
      className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors"
      style={{
        background: active ? 'var(--color-accent)' : 'var(--color-glass-bg)',
        color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
        border: `1px ${active ? 'solid' : 'dashed'} ${active ? 'transparent' : 'var(--color-glass-border)'}`,
        opacity: active ? 1 : isCappedAndInactive ? 0.3 : 0.5,
        fontFamily: 'var(--font-body)',
        cursor: isCappedAndInactive ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
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
  availableDives,
  onToggleDive,
  instructorOptions = [],
  boatOptions = [],
  poolOptions = [],
  shoreOptions = [],
  totalDays = 1,
  courseCodes = [],
  customerLanguages,
}: DayRowProps) {
  const showRemainingCheckbox = dayIndex < totalDays - 1

  function handleDiveToggle(slot: DiveSlot) {
    dispatch({ type: 'TOGGLE_DIVE', dayIndex, slot })
  }

  return (
    <GlassCard padding="sm">
      {/* Header */}
      <div
        className="flex items-center justify-between pb-2 mb-2 border-b"
        style={HEADER_BORDER_STYLE}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold uppercase tracking-wider text-secondary"
            style={HEADING_FONT_STYLE}
          >
            Day {dayNumber}
          </span>
          <span className="text-xs text-secondary" style={BODY_FONT_STYLE}>
            {formatDate(day.date)}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full text-secondary"
            style={DAY_LABEL_STYLE}
          >
            {deriveDayLabel(day)}
          </span>
          {day.isAutoAppended && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={AUTO_APPENDED_STYLE}
            >
              Auto-added
            </span>
          )}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_DAY', dayIndex })}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded opacity-50 hover:opacity-100 transition-opacity"
            style={REMOVE_BTN_STYLE}
            title="Remove day"
            aria-label={`Remove day ${dayNumber}`}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Row 1: Time fields */}
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

      {/* Row 2: Instructor (left half) + Dive pills (right half) */}
      <div className="grid grid-cols-2 gap-3 mb-3 items-end">
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
                placeholder="External"
              />
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'SET_DAY_INSTRUCTOR', dayIndex, slug: '' })
                  dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { externalInstructorName: '' } })
                }}
                className="text-xs underline underline-offset-2 text-left"
                style={SWITCH_LINK_STYLE}
              >
                Switch to system instructor
              </button>
            </>
          ) : (
            <GlassSelect
              label="Instructor"
              data-testid="instructor-select"
              value={day.instructorSlug ?? ''}
              onChange={(v) => {
                dispatch({ type: 'SET_DAY_INSTRUCTOR', dayIndex, slug: v })
                if (v && showRemainingCheckbox) {
                  dispatch({ type: 'APPLY_INSTRUCTOR_TO_REMAINING', fromDayIndex: dayIndex, slug: v })
                }
              }}
              options={[
                { id: '__external__', label: 'External (not in system)' },
                ...instructorOptions,
              ]}
              placeholder="Select instructor…"
              customerLanguages={customerLanguages}
            />
          )}
        </div>

        {/* Dive pills */}
        {(() => {
          const displaySlots = availableDives ?? day.dives
          if (displaySlots.length === 0) {
            return (
              <p
                className="text-xs text-center py-2 text-secondary"
                style={BODY_FONT_STYLE}
              >
                No dives scheduled
              </p>
            )
          }
          return (
            <div className="flex flex-wrap gap-1 items-end pb-1">
              {displaySlots.map((slot, i) => {
                const isActive = day.dives.some(
                  (d) => d.courseCode === slot.courseCode && d.diveNumber === slot.diveNumber && d.isConfined === slot.isConfined,
                )
                const isCapped = 'capped' in slot && (slot as DiveSlotDef).capped === true
                return (
                  <DivePill
                    key={`${slot.courseCode}-${slot.diveNumber}-${slot.isConfined}-${i}`}
                    slot={slot}
                    active={isActive}
                    capped={isCapped}
                    onToggle={() =>
                      onToggleDive
                        ? onToggleDive(dayIndex, { courseCode: slot.courseCode, diveNumber: slot.diveNumber, isConfined: slot.isConfined })
                        : handleDiveToggle({ courseCode: slot.courseCode, diveNumber: slot.diveNumber, isConfined: slot.isConfined })
                    }
                  />
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Per-dive venue assignment (sorted by dive sequence order) */}
      {day.dives.length > 0 && (() => {
        // Sort dives by sequence: confined first, then by diveNumber
        const sequence = courseCodes.length > 0 ? buildDiveSequence(courseCodes) : []
        const sortedDives = [...day.dives].sort((a, b) => {
          const aIdx = sequence.findIndex(s => s.courseCode === a.courseCode && s.diveNumber === a.diveNumber && s.isConfined === a.isConfined)
          const bIdx = sequence.findIndex(s => s.courseCode === b.courseCode && s.diveNumber === b.diveNumber && s.isConfined === b.isConfined)
          if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx
          if (a.isConfined && !b.isConfined) return -1
          if (!a.isConfined && b.isConfined) return 1
          return a.diveNumber - b.diveNumber
        })
        // Map sorted dive back to its original index in day.dives
        const originalIndex = (dive: DiveSlot) =>
          day.dives.findIndex(d => d.courseCode === dive.courseCode && d.diveNumber === dive.diveNumber && d.isConfined === dive.isConfined)

        return (
          <div
            className="flex flex-col gap-2 pt-3 border-t mt-1"
            style={VENUE_SECTION_BORDER_STYLE}
          >
            <span className="text-[10px] uppercase tracking-wider font-bold text-secondary" style={HEADING_FONT_STYLE}>
              Venue Assignment
            </span>
            {sortedDives.map((dive) => {
              const diveIdx = originalIndex(dive)
              const diveLabel = dive.isConfined ? 'Confined' : `${dive.courseCode} ${dive.diveNumber}`
              const venueOptions: ('pool' | 'boat' | 'shore')[] = dive.isConfined
                ? ['pool', 'boat', 'shore']
                : ['boat', 'shore']
              const currentVenue = dive.venueType ?? (dive.isConfined ? 'pool' : 'boat')
              const resourceOpts = currentVenue === 'pool' ? poolOptions : currentVenue === 'shore' ? shoreOptions : boatOptions

              return (
                <div key={`venue-${dive.courseCode}-${dive.diveNumber}-${dive.isConfined}`} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium w-16 shrink-0 text-primary" style={BODY_FONT_STYLE}>
                      {diveLabel}
                    </span>
                    <div className="flex gap-1">
                      {venueOptions.map((vt) => {
                        const Icon = VENUE_ICONS[vt]
                        const isVenueSelected = currentVenue === vt
                        return (
                          <button
                            key={vt}
                            type="button"
                            onClick={() => dispatch({ type: 'SET_DIVE_VENUE', dayIndex, diveIndex: diveIdx, venueType: vt })}
                            className="flex items-center gap-0.5 min-h-[44px] px-2.5 py-1.5 rounded text-[10px] font-medium transition-colors border"
                            style={{
                              background: isVenueSelected ? 'var(--color-accent)' : 'var(--color-glass-bg)',
                              color: isVenueSelected ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                              borderColor: isVenueSelected ? 'transparent' : 'var(--color-glass-border)',
                              fontFamily: 'var(--font-body)',
                            }}
                            title={VENUE_LABELS[vt]}
                          >
                            <Icon size={10} />
                            {VENUE_LABELS[vt]}
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <GlassSimpleSelect
                        value={dive.resourceSlug ?? ''}
                        onChange={(slug) => {
                          const val = slug || undefined
                          // Set this dive's resource
                          dispatch({ type: 'SET_DIVE_VENUE', dayIndex, diveIndex: diveIdx, venueType: currentVenue, resourceSlug: val })
                          // Waterfall: fill subsequent dives with same venue type (same day + later days)
                          if (val) {
                            for (let j = diveIdx + 1; j < day.dives.length; j++) {
                              const nextDive = day.dives[j]
                              const nextVenue = nextDive.venueType ?? (nextDive.isConfined ? 'pool' : 'boat')
                              if (nextVenue === currentVenue && !nextDive.resourceSlug) {
                                dispatch({ type: 'SET_DIVE_VENUE', dayIndex, diveIndex: j, venueType: nextVenue, resourceSlug: val })
                              }
                            }
                            dispatch({ type: 'APPLY_DIVE_RESOURCE_TO_REMAINING', fromDayIndex: dayIndex + 1, venueType: currentVenue, resourceSlug: val })
                          }
                        }}
                        data-testid={`${currentVenue}-select`}
                        options={[
                          { value: '__external__', label: 'External (not in system)' },
                          ...resourceOpts.map((opt) => ({ value: opt.id, label: opt.label })),
                        ]}
                        placeholder={`Select ${VENUE_LABELS[currentVenue].toLowerCase()}…`}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}
    </GlassCard>
  )
}
