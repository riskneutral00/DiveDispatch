'use client'

import { useEffect, useRef } from 'react'
import { GlassCard, GlassButton } from '@/components/glass'
import { DayRow } from './day-row'
import { generateDays } from '@/lib/booking/generate-days'
import { getEndDateDefault, validatePrerequisites, validatePrerequisiteOrder, validateCourseCombo } from '@/lib/booking/course-validation'
import type { WizardState, WizardAction, CourseEntry } from '@/lib/booking/wizard-state'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { COURSE_CATALOG, COURSE_DISPLAY_LABELS } from '@/lib/constants/course-catalog'
import type { Dispatch } from 'react'
import { AlertTriangle, ChevronDown, Copy, OctagonX, Plus, RotateCw, Trash2 } from 'lucide-react'

interface ItineraryStepProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
}

// ── Course Codes for selector ───────────────────────────────────────────────

const COURSE_CODES: CourseCode[] = ['DSD', 'TRY_DIVE', 'OW', 'AOW', 'RESCUE', 'DM', 'FD', 'REFRESH', 'SPECIALTY']

// ── CourseEntryRow ──────────────────────────────────────────────────────────

interface CourseEntryRowProps {
  entry: CourseEntry
  customerId: string
  canRemove: boolean
  dispatch: Dispatch<WizardAction>
  agency: string
  minStartDate?: string
}

function CourseEntryRow({ entry, customerId, canRemove, dispatch, agency, minStartDate }: CourseEntryRowProps) {
  const agencyCodes = agency
    ? COURSE_CATALOG.filter((c) => c.agency === agency || c.agency === 'Universal').map((c) => c.code)
    : COURSE_CODES
  const uniqueCodes = [...new Set(agencyCodes)] as CourseCode[]

  function updateEntry(patch: Partial<Pick<CourseEntry, 'activityCode' | 'dates' | 'agency'>>) {
    dispatch({ type: 'UPDATE_COURSE_ENTRY', customerId, entryId: entry.id, patch })
  }

  function handleCourseChange(code: string) {
    const startDate = entry.dates[0] ?? ''
    const endDate = startDate ? getEndDateDefault(code, startDate) : ''
    updateEntry({
      activityCode: code,
      dates: startDate ? [startDate, endDate] : [],
    })
  }

  function handleStartDateChange(val: string) {
    // Auto-fill end date from course defaults
    const endDate = entry.activityCode
      ? getEndDateDefault(entry.activityCode, val)
      : val
    updateEntry({ dates: [val, endDate] })
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
        <div className="flex flex-col gap-1 min-w-0">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
            Course
          </label>
          <div className="relative">
            <select
              value={entry.activityCode}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="glass glass-field w-full text-sm py-2 pl-3 pr-8 appearance-none"
              style={{ color: entry.activityCode ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              <option value="">Select course…</option>
              {uniqueCodes.map((code) => (
                <option key={code} value={code}>{COURSE_DISPLAY_LABELS[code]}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-secondary)' }} />
          </div>
        </div>

        {/* Start date */}
        <div className="flex flex-col gap-1 min-w-0">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
            Start date
          </label>
          <input
            type="date"
            value={entry.dates[0] ?? ''}
            min={minStartDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker()}
            className="glass glass-field w-full text-sm py-2 px-3 cursor-pointer"
            style={{ color: 'var(--color-text-primary)', caretColor: 'var(--color-accent)' }}
          />
        </div>

        {/* End date */}
        <div className="flex flex-col gap-1 min-w-0">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
            End date
          </label>
          <div className="flex gap-1 items-center">
            <input
              type="date"
              value={entry.dates[1] ?? entry.dates[0] ?? ''}
              min={entry.dates[0]}
              onChange={(e) => handleEndDateChange(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker()}
              className="glass glass-field flex-1 text-sm py-2 px-3 cursor-pointer"
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

// ── Main Component ──────────────────────────────────────────────────────────

export function ItineraryStep({ state, dispatch }: ItineraryStepProps) {
  const { customers, days, agency, sameForAll } = state
  const prevCoursesRef = useRef<string>('')

  // Derive all course codes and date range
  const allCourseCodes: CourseCode[] = [...new Set(
    customers.flatMap((c) => (c.courseEntries ?? []).map((e) => e.activityCode as CourseCode)).filter(Boolean),
  )]
  const hasDateRange = state.startDate && state.endDate

  // Prerequisite ordering errors (hard block) — per-customer
  const orderingErrors = customers.flatMap((c) =>
    validatePrerequisiteOrder(
      (c.courseEntries ?? []).map((e) => ({ activityCode: e.activityCode, dates: e.dates })),
    ),
  )
  const uniqueOrderingErrors = [...new Set(orderingErrors)]

  // Prerequisite and combo warnings (soft)
  const prereqWarnings = validatePrerequisites(allCourseCodes)
  const comboWarnings = validateCourseCombo(allCourseCodes)
  const allWarnings = [...prereqWarnings, ...comboWarnings]

  // Auto-generate days when courses + dates change
  useEffect(() => {
    const key = `${allCourseCodes.sort().join(',')}|${state.startDate}|${state.endDate}`
    if (key === prevCoursesRef.current) return
    if (!state.startDate || !state.endDate || allCourseCodes.length === 0) return
    prevCoursesRef.current = key

    const newDays = generateDays(allCourseCodes, state.startDate, 3, state.endDate)
    if (newDays.length > 0) {
      dispatch({ type: 'SET_DAYS', days: newDays })
    }
  }, [allCourseCodes, state.startDate, state.endDate, dispatch])

  function handleRebuild() {
    if (!hasDateRange) return
    const newDays = generateDays(allCourseCodes, state.startDate, 3, state.endDate)
    dispatch({ type: 'SET_DAYS', days: newDays })
  }

  const customerNames = customers.map((c) => c.name || 'Customer')

  return (
    <div className="flex flex-col gap-5">
      {/* Copy-to-all toggle */}
      {customers.length > 1 && (
        <label
          className="flex items-center gap-2 text-sm cursor-pointer"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          <input
            type="checkbox"
            checked={sameForAll}
            onChange={(e) => dispatch({ type: 'SET_SAME_FOR_ALL', value: e.target.checked })}
            className="accent-[var(--color-accent)]"
          />
          Same courses for all customers
        </label>
      )}

      {/* Per-customer course entries */}
      {(sameForAll ? customers.slice(0, 1) : customers).map((customer) => (
        <div key={customer.id}>
          <div className="flex items-center justify-between mb-2">
            <h3
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
            >
              {sameForAll && customers.length > 1 ? 'All customers' : customer.name}
            </h3>
            {sameForAll && customers.length > 1 && (
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
                <Copy size={10} className="inline mr-1" />
                Applies to {customers.length} customers
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {(customer.courseEntries ?? []).map((entry, idx, arr) => {
              const prev = idx > 0 ? arr[idx - 1] : undefined
              const minStart = prev?.dates[1] || prev?.dates[0] || undefined
              return (
                <CourseEntryRow
                  key={entry.id}
                  entry={entry}
                  customerId={customer.id}
                  canRemove={(customer.courseEntries?.length ?? 0) > 1}
                  dispatch={dispatch}
                  agency={agency}
                  minStartDate={minStart}
                />
              )
            })}
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

      {/* Ordering errors (hard block) */}
      {uniqueOrderingErrors.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {uniqueOrderingErrors.map((error, i) => (
            <div
              key={i}
              className="flex items-start gap-2 px-3 py-2 rounded-[var(--border-radius)] text-xs"
              role="alert"
              style={{
                background: 'color-mix(in srgb, var(--color-destructive, #ef4444) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-destructive, #ef4444) 30%, transparent)',
                color: 'var(--color-destructive, #ef4444)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <OctagonX size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Warnings (soft) */}
      {allWarnings.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {allWarnings.map((warning, i) => (
            <div
              key={i}
              className="flex items-start gap-2 px-3 py-2 rounded-[var(--border-radius)] text-xs"
              role="alert"
              style={{
                background: 'color-mix(in srgb, var(--color-warning, #f59e0b) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-warning, #f59e0b) 30%, transparent)',
                color: 'var(--color-warning, #f59e0b)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
              <span>{warning}</span>
            </div>
          ))}
        </div>
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
            <GlassButton variant="secondary" size="sm" onClick={handleRebuild}>
              <RotateCw size={12} />
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
              canRemove={days.length > 1}
              customerNames={customerNames}
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
