'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard, GlassButton } from '@/components/glass'
import { DayRow } from './day-row'
import { ResourceStep } from './resource-step'
import { generateDays, getAvailableDives, autoDistributeFromDive, buildDiveSequence, cascadeRemoveOrphans } from '@/lib/booking/generate-days'
import { getEndDateDefault, validatePrerequisites, validatePrerequisiteOrder, validateCourseCombo, validateCourseDateOverlap, validateNoDuplicateCourses, validateStartDateNotInPast, calculateComboDates, getUnavailableCodes, detectReferralWarnings } from '@/lib/booking/course-validation'
import { toISODateString } from '@/lib/utils/date'
import type { WizardState, WizardAction, CourseEntry, DiveSlot, DayConfig } from '@/lib/booking/wizard-state'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { COURSE_CATALOG, COURSE_DISPLAY_LABELS, COMBO_COURSES } from '@/lib/constants/course-catalog'
import { addDays } from '@/lib/utils/date'
import type { Dispatch } from 'react'
import { AlertTriangle, ChevronDown, Copy, OctagonX, Plus, RotateCw, Trash2 } from 'lucide-react'

interface ItineraryStepProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
}

// ── Course Codes for selector ───────────────────────────────────────────────

const COURSE_CODES: CourseCode[] = ['DSD', 'TRY_DIVE', 'OW', 'AOW', 'RESCUE', 'DM', 'FD', 'REFRESH', 'SPECIALTY']

// ── O+A Combo Locks ─────────────────────────────────────────────────────────
// When booking an O+A combo, OW-4 (must complete OW) and AOW-1 (must start AOW)
// are auto-selected and non-toggleable.



// ── CourseEntryRow ──────────────────────────────────────────────────────────

interface CourseEntryRowProps {
  entry: CourseEntry
  customerId: string
  canRemove: boolean
  dispatch: Dispatch<WizardAction>
  agency: string
  minStartDate?: string
  nextEntry?: CourseEntry
  unavailableCodes?: Set<string>
}

function CourseEntryRow({ entry, customerId, canRemove, dispatch, agency, minStartDate, nextEntry, unavailableCodes }: CourseEntryRowProps) {
  const agencyCodes = agency
    ? COURSE_CATALOG.filter((c) => c.agency === agency || c.agency === 'Universal').map((c) => c.code)
    : COURSE_CODES
  const uniqueCodes = [...new Set(agencyCodes)].filter(
    (c) => !unavailableCodes?.has(c),
  ) as CourseCode[]

  function updateEntry(patch: Partial<Pick<CourseEntry, 'activityCode' | 'dates' | 'agency'>>) {
    dispatch({ type: 'UPDATE_COURSE_ENTRY', customerId, entryId: entry.id, patch })
  }

  function handleCourseChange(code: string) {
    // O+A combo: create OW entry + auto-add AOW entry with correct date ranges
    if (code === 'O+A') {
      const startDate = entry.dates[0] ?? ''
      if (startDate) {
        const combo = calculateComboDates(startDate)
        updateEntry({
          activityCode: 'OW',
          dates: combo.owDates,
        })
        dispatch({
          type: 'ADD_COURSE_ENTRY',
          customerId,
          initialData: {
            activityCode: 'AOW',
            dates: combo.aowDates,
            agency: entry.agency,
          },
        })
      } else {
        updateEntry({ activityCode: 'OW', dates: [] })
        dispatch({
          type: 'ADD_COURSE_ENTRY',
          customerId,
          initialData: { activityCode: 'AOW', dates: [], agency: entry.agency },
        })
      }
      return
    }

    const startDate = entry.dates[0] ?? ''
    const endDate = startDate ? getEndDateDefault(code, startDate) : ''
    updateEntry({
      activityCode: code,
      dates: startDate ? [startDate, endDate] : [],
    })
  }

  function handleStartDateChange(val: string) {
    // O+A: detect OW+AOW combo for correct shared transition day dates
    const isOACombo = entry.activityCode === 'OW' && nextEntry?.activityCode === 'AOW'

    if (isOACombo) {
      // O+A: OW gets [start, owEnd], AOW gets [owEnd, aowEnd]
      const combo = calculateComboDates(val)
      updateEntry({ dates: combo.owDates })
      dispatch({
        type: 'UPDATE_COURSE_ENTRY',
        customerId,
        entryId: nextEntry!.id,
        patch: { dates: combo.aowDates },
      })
    } else {
      const endDate = entry.activityCode
        ? getEndDateDefault(entry.activityCode, val)
        : val
      updateEntry({ dates: [val, endDate] })

      // General cascade: next starts day after current ends
      if (nextEntry && !nextEntry.dates[0]) {
        const nextStart = addDays(endDate, 1)
        const nextEnd = nextEntry.activityCode
          ? getEndDateDefault(nextEntry.activityCode, nextStart)
          : nextStart
        dispatch({
          type: 'UPDATE_COURSE_ENTRY',
          customerId,
          entryId: nextEntry.id,
          patch: { dates: [nextStart, nextEnd] },
        })
      }
    }
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
            Activity
          </label>
          <div className="relative">
            <select
              value={entry.activityCode}
              onChange={(e) => handleCourseChange(e.target.value)}
              data-testid="course-activity-select"
              className="glass glass-field w-full text-sm py-2 pl-3 pr-8 appearance-none"
              style={{ color: entry.activityCode ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              <option value="">Select activity…</option>
              {uniqueCodes.map((code) => (
                <option key={code} value={code}>{COURSE_DISPLAY_LABELS[code]}</option>
              ))}
              <option disabled>──────────</option>
              <option value="O+A">{COMBO_COURSES['O+A'].label}</option>
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
            data-testid="course-start-date"
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
              <GlassButton
                variant="destructive-ghost"
                size="sm"
                type="button"
                onClick={() => dispatch({ type: 'REMOVE_COURSE_ENTRY', customerId, entryId: entry.id })}
                aria-label="Remove course"
              >
                <Trash2 size={16} />
              </GlassButton>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { filterByAvailability } from '@/lib/booking/availability-filter'

// ── Main Component ──────────────────────────────────────────────────────────

export function ItineraryStep({ state, dispatch }: ItineraryStepProps) {
  const { customers, days, agency, sameForAll } = state
  const prevCoursesRef = useRef<string>('')

  // Load instructor and venue options for inline day-row pickers
  const instructors = useQuery(api.directory.listByRole, { role: 'Instructor' }) ?? []
  const boats = useQuery(api.directory.listByRole, { role: 'Boat' }) ?? []
  const pools = useQuery(api.directory.listByRole, { role: 'Pool' }) ?? []
  const shoreOptions = useQuery(api.availability.listDiveSites) ?? []
  const instructorOptions = instructors.map((r) => ({ id: r.slug, label: r.name, languages: r.languages, isPreferred: r.isPreferred }))
  const customerLanguageCodes = customers.flatMap(c => (c.flags ?? []).map(f => f.code))
  const boatOptions = boats.map((r) => ({ id: r.slug, label: r.name }))
  const poolOptions = pools.map((r) => ({ id: r.slug, label: r.name }))

  // Load inventory units to map owner slugs → inventory unit Convex doc IDs.
  // The review step needs these IDs to create sessions/reservations.
  const instructorInventory = useQuery(api.availability.listInventoryByType, { type: 'Instructor' }) ?? []
  const boatInventory = useQuery(api.availability.listInventoryByType, { type: 'Boat' }) ?? []
  const poolInventory = useQuery(api.availability.listInventoryByType, { type: 'Pool' }) ?? []
  const inventoryMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const r of instructorInventory) map[r.ownerId] = r.id
    for (const r of boatInventory) map[r.ownerId] = r.id
    for (const r of poolInventory) map[r.ownerId] = r.id
    // Shore options use resourceId as identifier (dive sites may be unowned)
    // inventoryMap for shores will be populated when needed via listDiveSites
    return map
  }, [instructorInventory, boatInventory, poolInventory])

  // Real-time availability: per-date capacity for all inventory units
  const bookingDates = useMemo(() => days.map(d => d.date), [days])
  const capacityData = useQuery(
    api.availability.getCapacityForDates,
    bookingDates.length > 0 ? { dates: bookingDates } : 'skip',
  )

  useEffect(() => {
    if (Object.keys(inventoryMap).length > 0) {
      dispatch({ type: 'SET_INVENTORY_MAP', map: inventoryMap })
    }
  }, [inventoryMap, dispatch])

  // Derive all course codes and date range
  const allCourseCodes: CourseCode[] = [...new Set(
    customers.flatMap((c) => (c.courseEntries ?? []).map((e) => e.activityCode as CourseCode)).filter(Boolean),
  )]
  const hasDateRange = state.startDate && state.endDate

  // Hard block errors — per-customer
  const today = toISODateString(new Date())
  const hardErrors: string[] = []
  for (const c of sameForAll ? customers.slice(0, 1) : customers) {
    const entries = (c.courseEntries ?? []).map((e) => ({ activityCode: e.activityCode, dates: e.dates }))
    const codes = entries.map((e) => e.activityCode).filter(Boolean)
    hardErrors.push(...validatePrerequisiteOrder(entries))
    hardErrors.push(...validateCourseDateOverlap(entries))
    hardErrors.push(...validateNoDuplicateCourses(entries))
    hardErrors.push(...validateStartDateNotInPast(entries, today))
  }
  const uniqueOrderingErrors = [...new Set(hardErrors)]

  // Prerequisite and combo warnings (soft).
  const prereqWarnings = validatePrerequisites(allCourseCodes)
  const comboWarnings = validateCourseCombo(allCourseCodes)

  // Instructor ratio check
  const diverCount = customers.length
  const instructorRatioWarnings: string[] = []
  if (diverCount > 0 && allCourseCodes.length > 0) {
    // Find the most restrictive maxDiversPerInstructor across all selected courses
    const agencyFilter = agency || undefined
    let minRatio = Infinity
    for (const code of allCourseCodes) {
      const entry = COURSE_CATALOG.find((c) => c.code === code && (!agencyFilter || c.agency === agencyFilter || c.agency === 'Universal'))
        ?? COURSE_CATALOG.find((c) => c.code === code)
      if (entry && entry.maxDiversPerInstructor < minRatio) {
        minRatio = entry.maxDiversPerInstructor
      }
    }
    if (minRatio < Infinity && diverCount > minRatio) {
      const requiredInstructors = Math.ceil(diverCount / minRatio)
      instructorRatioWarnings.push(
        `${diverCount} divers with max ${minRatio} per instructor — minimum ${requiredInstructors} instructors/DMs required.`,
      )
    }
  }

  // Referral detection — warn when first selected dive is not the first in sequence
  const allSelectedDives = days.flatMap(d => d.dives)
  const referralWarnings = detectReferralWarnings(allSelectedDives, allCourseCodes)

  // Empty day warning — date range produces more days than dives fill
  const emptyDayWarnings: string[] = []
  const daysWithDives = days.filter(d => d.dives.length > 0).length
  if (days.length > 0 && daysWithDives > 0 && daysWithDives < days.length) {
    emptyDayWarnings.push(
      `${days.length} days scheduled but only ${daysWithDives} have activities. Remove empty days or adjust end date.`,
    )
  }

  const allWarnings = [...prereqWarnings, ...comboWarnings, ...instructorRatioWarnings, ...referralWarnings]

  // Auto-generate days when courses + dates change
  const preFillAppliedRef = useRef(false)
  useEffect(() => {
    const key = `${[...allCourseCodes].sort().join(',')}|${state.startDate}|${state.endDate}`
    if (key === prevCoursesRef.current) return
    if (!state.startDate || !state.endDate || allCourseCodes.length === 0) return
    prevCoursesRef.current = key

    let newDays = generateDays(allCourseCodes, state.startDate, 3, state.endDate)

    // Apply pre-fill resource hints to generated days (first generation only)
    if (!preFillAppliedRef.current && newDays.length > 0) {
      const { preFillInstructorSlug, preFillVenueSlug, preFillBoatSlug } = state
      if (preFillInstructorSlug || preFillVenueSlug || preFillBoatSlug) {
        preFillAppliedRef.current = true
        newDays = newDays.map((day) => ({
          ...day,
          instructorSlug: preFillInstructorSlug || day.instructorSlug,
          dives: day.dives.map((dive) => {
            const venueType = dive.venueType ?? (dive.isConfined ? 'pool' : 'boat')
            // Pool/shore → use venue slug, boat → use boat slug
            const resourceSlug = venueType === 'boat'
              ? (preFillBoatSlug || dive.resourceSlug)
              : (preFillVenueSlug || dive.resourceSlug)
            return { ...dive, resourceSlug }
          }),
        }))
      }
    }

    if (newDays.length > 0) {
      dispatch({ type: 'SET_DAYS', days: newDays })
    }
  }, [allCourseCodes, state.startDate, state.endDate, state.preFillInstructorSlug, state.preFillVenueSlug, state.preFillBoatSlug, dispatch])

  function handleRebuild() {
    if (!hasDateRange) return
    const newDays = generateDays(allCourseCodes, state.startDate, 3, state.endDate)
    dispatch({ type: 'SET_DAYS', days: newDays })
  }

  function handleToggleDive(dayIndex: number, slot: DiveSlot) {
    const day = days[dayIndex]
    if (!day) return

    const diveKey = `${slot.courseCode}:${slot.diveNumber}:${slot.isConfined}`
    const exists = day.dives.some(
      (d) => d.courseCode === slot.courseCode && d.diveNumber === slot.diveNumber && d.isConfined === slot.isConfined,
    )

    let newDays: typeof days
    if (exists) {
      // Remove the clicked dive AND all dives after it in the global sequence from this day.
      // Then redistribute those later dives to subsequent days.
      const sequence = buildDiveSequence(allCourseCodes)
      const clickedIdx = sequence.findIndex(s =>
        s.courseCode === slot.courseCode && s.diveNumber === slot.diveNumber && s.isConfined === slot.isConfined)

      // Remove clicked dive + all later dives (in global sequence) from this day
      newDays = days.map((d, i) => {
        if (i !== dayIndex) return d
        const kept: DiveSlot[] = []
        for (const dv of d.dives) {
          const dvIdx = sequence.findIndex(s =>
            s.courseCode === dv.courseCode && s.diveNumber === dv.diveNumber && s.isConfined === dv.isConfined)
          if (dvIdx < clickedIdx) kept.push(dv)
        }
        return { ...d, dives: kept }
      })

      // Clean up orphans across all days (cross-day ordering + course prerequisites)
      newDays = cascadeRemoveOrphans(newDays, allCourseCodes)
    } else {
      // Adding a dive — enforce per-day non-confined limit
      if (!slot.isConfined) {
        const nonConfinedCount = day.dives.filter(d => !d.isConfined).length
        if (nonConfinedCount >= (day.divesPerDay || 3)) return
      }
      const totalDivesBefore = days.flatMap(d => d.dives).length
      newDays = days.map((d, i) => {
        if (i !== dayIndex) return d
        return { ...d, dives: [...d.dives, { courseCode: slot.courseCode, diveNumber: slot.diveNumber, isConfined: slot.isConfined, venueType: slot.isConfined ? 'pool' as const : 'boat' as const }] }
      })
      // First dive selected globally → auto-fill remaining dives across all days
      if (totalDivesBefore === 0) {
        newDays = autoDistributeFromDive(newDays, slot, allCourseCodes)
      }
    }

    dispatch({ type: 'SET_DAYS', days: newDays })
  }



  return (
    <div className="flex flex-col gap-5">
      {/* Copy-to-all toggle — disabled (Coming soon) */}
      {customers.length > 1 && (
        <label
          className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', opacity: 0.5, cursor: 'not-allowed' }}
          title="Coming soon"
        >
          <input
            type="checkbox"
            checked={false}
            disabled
            className="accent-[var(--color-accent)]"
            aria-label="Same courses for all customers (coming soon)"
          />
          Same courses for all customers
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-glass-border)', color: 'var(--color-text-secondary)' }}>
            Coming soon
          </span>
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
              const next = idx < arr.length - 1 ? arr[idx + 1] : undefined
              const minStart = prev?.dates[1] || prev?.dates[0] || today
              const unavailable = getUnavailableCodes(arr, idx)
              return (
                <CourseEntryRow
                  key={entry.id}
                  entry={entry}
                  customerId={customer.id}
                  canRemove={(customer.courseEntries?.length ?? 0) > 1}
                  dispatch={dispatch}
                  agency={agency}
                  minStartDate={minStart}
                  nextEntry={next}
                  unavailableCodes={unavailable}
                />
              )
            })}
          </div>

          <GlassButton
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => dispatch({ type: 'ADD_COURSE_ENTRY', customerId: customer.id })}
            className="mt-2"
          >
            <Plus size={16} />
            Add activity
          </GlassButton>
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
                background: 'color-mix(in srgb, var(--color-destructive, #dc2626) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-destructive, #dc2626) 30%, transparent)',
                color: 'var(--color-destructive, #dc2626)',
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
                background: 'color-mix(in srgb, var(--color-warning, #fbbf24) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-warning, #fbbf24) 30%, transparent)',
                color: 'var(--color-warning, #fbbf24)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Day rows — hidden when no courses selected */}
      {days.length > 0 && allCourseCodes.length > 0 && (
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
              availableDives={getAvailableDives(idx, days, allCourseCodes)}
              onToggleDive={handleToggleDive}
              instructorOptions={filterByAvailability(instructorOptions, day.date, capacityData, inventoryMap)}
              boatOptions={filterByAvailability(boatOptions, day.date, capacityData, inventoryMap)}
              poolOptions={filterByAvailability(poolOptions, day.date, capacityData, inventoryMap)}
              shoreOptions={shoreOptions}
              totalDays={days.length}
              courseCodes={allCourseCodes}
              customerLanguages={customerLanguageCodes}
            />
          ))}
        </div>
      )}

      {/* Empty day warning — between day cards and equipment */}
      {emptyDayWarnings.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {emptyDayWarnings.map((warning, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-start gap-2 px-3 py-2 rounded-[var(--border-radius)] text-xs"
              role="alert"
              style={{
                background: 'color-mix(in srgb, var(--color-warning, #fbbf24) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-warning, #fbbf24) 30%, transparent)',
                color: 'var(--color-warning, #fbbf24)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Resources (instructors, venues, equipment) — shown after days are generated */}
      {days.length > 0 && allCourseCodes.length > 0 && (
        <ResourceStep state={state} dispatch={dispatch} />
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
