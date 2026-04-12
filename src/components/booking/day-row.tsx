'use client'

import { X, Anchor, Waves, Droplets } from 'lucide-react'
import { Card, Input, Select, SimpleSelect, IconButton, ActionLink } from '@/components/ui'
import type { DayConfig, WizardAction, DiveSlot } from '@/lib/booking/wizard-state'
import type { DiveSlotDef } from '@/lib/booking/generate-days'
import { buildDiveSequence } from '@/lib/booking/generate-days'
import type { Dispatch } from 'react'
import { getCourseByCode } from '@/lib/constants/course-catalog'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { languageFlagText } from '@/components/profiles/language-flags'

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
  availableDives?: DiveSlotDef[]
  onToggleDive?: (dayIndex: number, slot: DiveSlot) => void
  instructorOptions?: ResourceOption[]
  diveMasterOptions?: ResourceOption[]
  boatOptions?: ResourceOption[]
  poolOptions?: ResourceOption[]
  shoreOptions?: ResourceOption[]
  totalDays?: number
  courseCodes?: string[]
  customerLanguages?: string[]
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function deriveDayLabel(): string {
  return 'Dive Day'
}

const DAY_LABEL_CLASS = 'glass-container'

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


function DivePill({
  slot,
  active,
  capped,
  onToggle,
}: {
  slot: DiveSlot
  active: boolean
  capped?: boolean
  onToggle: () => void
}) {
  const label = slot.isConfined
    ? 'Confined'
    : `${slot.courseCode} ${slot.diveNumber}`

  const isCappedAndInactive = capped && !active

  return (
    <button /* design-ok: dive-slot toggle pill with per-slot state styling */
      type="button"
      onClick={isCappedAndInactive ? undefined : onToggle}
      disabled={isCappedAndInactive}
      title={
        isCappedAndInactive
          ? 'Day limit reached — max 3 dives'
          : getCourseByCode(slot.courseCode as CourseCode)?.name ?? slot.courseCode
      }
      className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors duration-theme"
      style={{
        background: active ? 'var(--color-accent)' : 'var(--color-glass-bg)',
        color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
        border: `1px ${active ? 'solid' : 'dashed'} ${active ? 'transparent' : 'var(--color-glass-border)'}`,
        opacity: active ? 1 : isCappedAndInactive ? 0.3 : 0.5,
        cursor: isCappedAndInactive ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  )
}

export function DayRow({
  day,
  dayIndex,
  dayNumber,
  dispatch,
  canRemove = false,
  availableDives,
  onToggleDive,
  instructorOptions = [],
  diveMasterOptions = [],
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
    <Card padding="sm">
      <div
        className="flex items-center justify-between pb-2 mb-2 border-b border-glass-border"
      >
        <div className="flex items-center gap-2">
          <span
            className="text-label font-bold uppercase tracking-wide text-secondary font-heading"
          >
            Day {dayNumber}
          </span>
          <span className="text-label text-secondary">
            {formatDate(day.date)}
          </span>
          <span
            className={`text-label px-1.5 py-0.5 rounded-full text-secondary ${DAY_LABEL_CLASS}`}
          >
            {deriveDayLabel()}
          </span>
          {day.isAutoAppended && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning-muted text-warning" /* design-ok: dense calendar auto-added badge */
            >
              Auto-added
            </span>
          )}
        </div>
        {canRemove && (
          <IconButton
            variant="ghost"
            onClick={() => dispatch({ type: 'REMOVE_DAY', dayIndex })}
            aria-label={`Remove day ${dayNumber}`}
            className="opacity-50 hover:opacity-100"
          >
            <X size={13} />
          </IconButton>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Input
          label="Start time"
          type="time"
          value={day.startTime}
          onChange={(e) => dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { startTime: e.target.value } })}
        />
        <Input
          label="End time"
          type="time"
          value={day.endTime}
          onChange={(e) => dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { endTime: e.target.value } })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 items-end">
        <div className="flex flex-col gap-1">
          {day.instructorSlug === '__external__' ? (
            <>
              <Input
                label="Instructor (external)"
                value={day.externalInstructorName ?? ''}
                onChange={(e) =>
                  dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { externalInstructorName: e.target.value } })
                }
                placeholder="External"
              />
              <ActionLink
                onClick={() => {
                  dispatch({ type: 'SET_DAY_INSTRUCTOR', dayIndex, slug: '' })
                  dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { externalInstructorName: '' } })
                }}
              >
                Switch to system instructor
              </ActionLink>
            </>
          ) : (
            <Select
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

        {(() => {
          const displaySlots = availableDives ?? day.dives
          if (displaySlots.length === 0) {
            return (
              <p
                className="text-label text-center py-2 text-secondary"
              >
                No dives scheduled
              </p>
            )
          }
          return (
            <div className="flex flex-wrap gap-1 items-end pb-1 reading-plane rounded-theme p-2">
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

      {(diveMasterOptions.length > 0 || day.diveMasterSlug) && (
        <div className="mb-3">
          {day.diveMasterSlug === '__external__' ? (
            <>
              <Input
                label="Dive Master (external)"
                value={day.externalDiveMasterName ?? ''}
                onChange={(e) =>
                  dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { externalDiveMasterName: e.target.value } })
                }
                placeholder="Name"
              />
              <ActionLink
                onClick={() => {
                  dispatch({ type: 'SET_DAY_DIVE_MASTER', dayIndex, slug: '' })
                  dispatch({ type: 'UPDATE_DAY', dayIndex, patch: { externalDiveMasterName: '' } })
                }}
                className="mt-1"
              >
                Switch to system dive master
              </ActionLink>
            </>
          ) : (
            <SimpleSelect
              label="Dive Master (optional)"
              value={day.diveMasterSlug ?? ''}
              onChange={(v) => dispatch({ type: 'SET_DAY_DIVE_MASTER', dayIndex, slug: v })}
              options={[
                { value: '', label: 'None' },
                { value: '__external__', label: 'External (not in system)' },
                ...diveMasterOptions.map((opt) => ({
                  value: opt.id,
                  label: `${opt.label}${languageFlagText(opt.languages)}`,
                })),
              ]}
              placeholder="None"
            />
          )}
        </div>
      )}

      {day.dives.length > 0 && (() => {
        const sequence = courseCodes.length > 0 ? buildDiveSequence(courseCodes) : []
        const sortedDives = [...day.dives].sort((a, b) => {
          const aIdx = sequence.findIndex(s => s.courseCode === a.courseCode && s.diveNumber === a.diveNumber && s.isConfined === a.isConfined)
          const bIdx = sequence.findIndex(s => s.courseCode === b.courseCode && s.diveNumber === b.diveNumber && s.isConfined === b.isConfined)
          if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx
          if (a.isConfined && !b.isConfined) return -1
          if (!a.isConfined && b.isConfined) return 1
          return a.diveNumber - b.diveNumber
        })
        const originalIndex = (dive: DiveSlot) =>
          day.dives.findIndex(d => d.courseCode === dive.courseCode && d.diveNumber === dive.diveNumber && d.isConfined === dive.isConfined)

        return (
          <div
            className="flex flex-col gap-2 pt-3 border-t border-glass-border mt-1"
          >
            <span className="text-[10px] uppercase tracking-wide font-bold text-secondary font-heading">
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
                    <span className="text-label font-medium w-16 shrink-0 text-primary">
                      {diveLabel}
                    </span>
                    <div className="flex gap-1 reading-plane rounded-theme p-1">
                      {venueOptions.map((vt) => {
                        const Icon = VENUE_ICONS[vt]
                        const isVenueSelected = currentVenue === vt
                        return (
                          <button /* design-ok: venue-type selector chip */
                            key={vt}
                            type="button"
                            onClick={() => dispatch({ type: 'SET_DIVE_VENUE', dayIndex, diveIndex: diveIdx, venueType: vt })}
                            className="flex items-center gap-1 min-h-[44px] px-2.5 py-1.5 rounded-[var(--border-radius-button)] text-[10px] font-medium transition-colors duration-theme border"
                            style={{
                              background: isVenueSelected ? 'var(--color-accent)' : 'var(--color-glass-bg)',
                              color: isVenueSelected ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                              borderColor: isVenueSelected ? 'transparent' : 'var(--color-glass-border)',
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
                      <SimpleSelect
                        value={dive.resourceId ?? ''}
                        onChange={(slug) => {
                          const val = slug || undefined
                          dispatch({ type: 'SET_DIVE_VENUE', dayIndex, diveIndex: diveIdx, venueType: currentVenue, resourceId: val })
                          if (val) {
                            for (let j = diveIdx + 1; j < day.dives.length; j++) {
                              const nextDive = day.dives[j]
                              const nextVenue = nextDive.venueType ?? (nextDive.isConfined ? 'pool' : 'boat')
                              if (nextVenue === currentVenue && !nextDive.resourceId) {
                                dispatch({ type: 'SET_DIVE_VENUE', dayIndex, diveIndex: j, venueType: nextVenue, resourceId: val })
                              }
                            }
                            dispatch({ type: 'APPLY_DIVE_RESOURCE_TO_REMAINING', fromDayIndex: dayIndex + 1, venueType: currentVenue, resourceId: val })
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
    </Card>
  )
}
