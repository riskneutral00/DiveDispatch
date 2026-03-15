'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard, GlassButton } from '@/components/glass'
import { DayRow } from './day-row'
import { buildDefaultDays } from '@/lib/booking/session-builder'
import type { WizardState, WizardAction, CourseEntry } from '@/lib/booking/wizard-state'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { COURSE_CATALOG } from '@/lib/constants/course-catalog'
import type { Dispatch } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'

interface ItineraryStepProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
}

// ── Resource option shape ─────────────────────────────────────────────────────

interface ResourceOption {
  id: string
  label: string
}

// ── Course entry row ──────────────────────────────────────────────────────────

interface CourseEntryRowProps {
  entry: CourseEntry
  customerId: string
  canRemove: boolean
  dispatch: Dispatch<WizardAction>
  agency: string
}

const COURSE_CODES: CourseCode[] = ['DSD', 'TRY_DIVE', 'OW', 'AOW', 'RESCUE', 'DM', 'FD', 'REFRESH', 'SPECIALTY']

function CourseEntryRow({ entry, customerId, canRemove, dispatch, agency }: CourseEntryRowProps) {
  const agencyCodes = agency ? COURSE_CATALOG.filter(c => c.agency === agency || c.agency === 'Universal').map(c => c.code) : COURSE_CODES
  const uniqueCodes = [...new Set(agencyCodes)] as CourseCode[]

  function updateEntry(patch: Partial<Pick<CourseEntry, 'activityCode' | 'dates' | 'agency'>>) {
    dispatch({ type: 'UPDATE_COURSE_ENTRY', customerId, entryId: entry.id, patch })
  }

  function handleStartDateChange(val: string) {
    const end = entry.dates[1] ?? val
    updateEntry({ dates: [val, end >= val ? end : val] })
  }

  function handleEndDateChange(val: string) {
    const start = entry.dates[0] ?? val
    updateEntry({ dates: [start <= val ? start : val, val] })
  }

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-[var(--border-radius)] border"
      style={{ borderColor: 'var(--color-glass-border)', background: 'var(--color-glass-bg)' }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Course picker */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
            Course
          </label>
          <div className="relative">
            <select
              value={entry.activityCode}
              onChange={(e) => updateEntry({ activityCode: e.target.value })}
              className="glass glass-field w-full text-sm py-2 pl-3 pr-8 appearance-none"
              style={{ color: entry.activityCode ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              <option value="">Select course…</option>
              {uniqueCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }} />
          </div>
        </div>

        {/* Start date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
            Start date
          </label>
          <input
            type="date"
            value={entry.dates[0] ?? ''}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="glass glass-field w-full text-sm py-2 px-3"
            style={{ color: 'var(--color-text-primary)', caretColor: 'var(--color-accent)' }}
          />
        </div>

        {/* End date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
            End date
          </label>
          <div className="flex gap-1 items-center">
            <input
              type="date"
              value={entry.dates[1] ?? entry.dates[0] ?? ''}
              min={entry.dates[0]}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="glass glass-field flex-1 text-sm py-2 px-3"
              style={{ color: 'var(--color-text-primary)', caretColor: 'var(--color-accent)' }}
            />
            {canRemove && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'REMOVE_COURSE_ENTRY', customerId, entryId: entry.id })}
                className="p-2 opacity-50 hover:opacity-100 transition-opacity rounded"
                style={{ color: 'var(--color-destructive)' }}
                title="Remove course"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ItineraryStep({ state, dispatch }: ItineraryStepProps) {
  const { customers, days, agency } = state

  // Load resources for day-row selects
  const instructors = useQuery(api.directory.listByRole, { role: 'Instructor' }) ?? []
  const boats = useQuery(api.directory.listByRole, { role: 'Boat' }) ?? []
  const pools = useQuery(api.directory.listByRole, { role: 'Pool' }) ?? []

  const instructorOptions: ResourceOption[] = instructors.map((r) => ({ id: r.slug, label: r.name }))
  const boatOptions: ResourceOption[] = boats.map((r) => ({ id: r.slug, label: r.name }))
  const poolOptions: ResourceOption[] = pools.map((r) => ({ id: r.slug, label: r.name }))

  // Auto-build days when courses/dates are set but days are empty
  const derivedCourseCodes: CourseCode[] = [...new Set(
    customers.flatMap(c => (c.courseEntries ?? []).map(e => e.activityCode as CourseCode)).filter(Boolean)
  )]
  const hasDateRange = state.startDate && state.endDate

  function handleBuildDays() {
    if (!hasDateRange) return
    const newDays = buildDefaultDays(state.startDate, state.endDate, derivedCourseCodes)
    // Reset days via RESET action with new days
    dispatch({ type: 'RESET', payload: { ...state, days: newDays } })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Per-customer course entries */}
      {customers.map((customer) => (
        <div key={customer.id}>
          <div className="flex items-center justify-between mb-2">
            <h3
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
            >
              {customer.name}
            </h3>
            {customers.length > 1 && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'COPY_COURSE_ENTRIES_TO_ALL' })}
                className="text-xs"
                style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
              >
                Copy to all
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {(customer.courseEntries ?? []).map((entry) => (
              <CourseEntryRow
                key={entry.id}
                entry={entry}
                customerId={customer.id}
                canRemove={(customer.courseEntries?.length ?? 0) > 1}
                dispatch={dispatch}
                agency={agency}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => dispatch({ type: 'ADD_COURSE_ENTRY', customerId: customer.id })}
            className="flex items-center gap-1 mt-2 text-xs"
            style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)' }}
          >
            <Plus size={12} />
            Add course
          </button>
        </div>
      ))}

      {/* Auto-build days */}
      {hasDateRange && days.length === 0 && (
        <GlassCard padding="sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
              Date range set. Auto-build schedule?
            </p>
            <GlassButton variant="secondary" size="sm" onClick={handleBuildDays}>
              Build Days
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* Day rows */}
      {days.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
            >
              Schedule ({days.length} day{days.length !== 1 ? 's' : ''})
            </h3>
            <GlassButton variant="secondary" size="sm" onClick={handleBuildDays}>
              Rebuild
            </GlassButton>
          </div>
          {days.map((day, idx) => (
            <DayRow
              key={day.date + idx}
              day={day}
              dayIndex={idx}
              dayNumber={idx + 1}
              dispatch={dispatch}
              instructorOptions={instructorOptions}
              boatOptions={boatOptions}
              poolOptions={poolOptions}
              canRemove={days.length > 1}
            />
          ))}
        </div>
      )}

      {/* Empty state if no customers */}
      {customers.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
          Add customers in step 1 first.
        </p>
      )}
    </div>
  )
}
