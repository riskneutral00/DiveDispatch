'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { useWizardPreferences } from '@/lib/hooks/use-wizard-preferences'
import { Button, Checkbox, SimpleSelect, ErrorAlert } from '@/components/ui'
import { DayRow } from './day-row'
import { ResourceStep } from './resource-step'
import { generateDays, getAvailableDives, autoDistributeFromDive, buildDiveSequence, cascadeRemoveOrphans } from '@/lib/booking/generate-days'
import { getEndDateDefault, validatePrerequisites, validatePrerequisiteOrder, validateCourseCombo, validateCourseDateOverlap, validateNoDuplicateCourses, validateStartDateNotInPast, calculateComboDates, getUnavailableCodes, detectReferralWarnings } from '@/lib/booking/course-validation'
import { toISODateString } from '@/lib/utils/date'
import type { WizardState, WizardAction, CourseEntry, DiveSlot } from '@/lib/booking/wizard-state'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { COURSE_CATALOG, COURSE_DISPLAY_LABELS, COMBO_COURSES, COURSE_CODES } from '@/lib/constants/course-catalog'
import { addDays } from '@/lib/utils/date'
import type { Dispatch } from 'react'
import { Copy, OctagonX, Plus, RotateCw, Trash2 } from 'lucide-react'

interface ItineraryStepProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
  isEditMode?: boolean
}

function pickFirstAvailable(
  slugs: string[] | undefined,
  rows: { slug: string; available: boolean }[] | undefined,
): string {
  if (!slugs?.length || !rows?.length) return ''
  const map = new Map(rows.map((r) => [r.slug, r.available]))
  for (const s of slugs) {
    if (map.get(s) !== false) return s
  }
  return ''
}

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
    const isOACombo = entry.activityCode === 'OW' && nextEntry?.activityCode === 'AOW'

    if (isOACombo) {
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
      className="flex flex-col gap-2 p-3 rounded-theme glass-container"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="min-w-0">
          <SimpleSelect
            label="Activity"
            value={entry.activityCode}
            onChange={handleCourseChange}
            data-testid="course-activity-select"
            options={[
              ...uniqueCodes.map((code) => ({ value: code, label: COURSE_DISPLAY_LABELS[code] })),
              { value: '──────────', label: '──────────', disabled: true },
              { value: 'O+A', label: COMBO_COURSES['O+A'].label },
            ]}
            placeholder="Select activity…"
          />
        </div>

        <div className="flex flex-col gap-1 min-w-0 content-island rounded-theme p-2">
          <label className="text-body font-medium text-secondary">
            Start date
          </label>
          <input /* design-ok: native date picker */
            type="date"
            value={entry.dates[0] ?? ''}
            min={minStartDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker()}
            data-testid="course-start-date"
            className="field-underline w-full text-body py-2.5 px-0 cursor-pointer text-primary"
            style={{ caretColor: 'var(--color-accent)' }}
          />
        </div>

        <div className="flex flex-col gap-1 min-w-0 content-island rounded-theme p-2">
          <label className="text-body font-medium text-secondary">
            End date
          </label>
          <div className="flex gap-1 items-center">
            <input /* design-ok: native date picker */
              type="date"
              value={entry.dates[1] ?? entry.dates[0] ?? ''}
              min={entry.dates[0]}
              onChange={(e) => handleEndDateChange(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker()}
              className="field-underline flex-1 text-body py-2.5 px-0 cursor-pointer text-primary"
              style={{ caretColor: 'var(--color-accent)' }}
            />
            {canRemove && (
              <Button
                variant="destructive-ghost"
                size="sm"
                type="button"
                onClick={() => dispatch({ type: 'REMOVE_COURSE_ENTRY', customerId, entryId: entry.id })}
                aria-label="Remove course"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { filterByAvailability, enrichOptionsWithCapacity } from '@/lib/booking/availability-filter'

export function ItineraryStep({ state, dispatch, isEditMode = false }: ItineraryStepProps) {
  const { customers, days, agency, sameForAll } = state
  const prevCoursesRef = useRef<string>('')

  const instructors = useQuery(api.directory.listByRole, { role: 'Instructor' }) ?? []
  const diveMasters = useQuery(api.directory.listByRole, { role: 'DiveMaster' }) ?? []
  const boats = useQuery(api.directory.listByRole, { role: 'Boat' }) ?? []
  const pools = useQuery(api.directory.listByRole, { role: 'Pool' }) ?? []
  const shoreOptions = useQuery(api.availability.listDiveSites) ?? []
  const instructorOptions = instructors.map((r) => ({ id: r.slug, label: r.name, languages: r.languages, isPreferred: r.isPreferred }))
  const diveMasterOptions = diveMasters.map((r) => ({ id: r.slug, label: r.name, languages: r.languages, isPreferred: r.isPreferred }))
  const customerLanguageCodes = customers.flatMap(c => (c.flags ?? []).map(f => f.code))
  const boatOptions = boats.map((r) => ({ id: r.slug, label: r.name }))
  const poolOptions = pools.map((r) => ({ id: r.slug, label: r.name }))

  const instructorInventory = useQuery(api.availability.listInventoryByType, { type: 'Instructor' }) ?? []
  const boatInventory = useQuery(api.availability.listInventoryByType, { type: 'Boat' }) ?? []
  const poolInventory = useQuery(api.availability.listInventoryByType, { type: 'Pool' }) ?? []
  const inventoryMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const r of instructorInventory) map[r.ownerId] = r.id
    for (const r of boatInventory) map[r.ownerId] = r.id
    for (const r of poolInventory) map[r.ownerId] = r.id
    return map
  }, [instructorInventory, boatInventory, poolInventory])

  const bookingDates = useMemo(() => days.map(d => d.date), [days])
  const capacityData = useQuery(
    api.availability.getCapacityForDates,
    bookingDates.length > 0 ? { dates: bookingDates } : 'skip',
  )

  const { prefs: cascadePrefs, isLoading: cascadePrefsLoading } = useWizardPreferences(
    state.referralOwnerSlug ?? null,
  )

  const preferredSlugsForCheck = useMemo(
    () => ({
      instructor: cascadePrefs?.preferredInstructorSlugs ?? [],
      venue: cascadePrefs?.preferredVenueSlugs ?? [],
      boat: cascadePrefs?.preferredBoatSlugs ?? [],
      equipment: cascadePrefs?.preferredEquipmentSlugs ?? [],
      compressor: cascadePrefs?.preferredCompressorSlugs ?? [],
    }),
    [cascadePrefs],
  )

  const prefAvailability = useQuery(
    api.availability.checkPreferredAvailability,
    bookingDates.length > 0 && cascadePrefs && !cascadePrefsLoading
      ? { dates: bookingDates, preferredSlugs: preferredSlugsForCheck }
      : 'skip',
  )

  useEffect(() => {
    if (Object.keys(inventoryMap).length > 0) {
      dispatch({ type: 'SET_INVENTORY_MAP', map: inventoryMap })
    }
  }, [inventoryMap, dispatch])

  const preferenceCascadeAppliedRef = useRef(false)
  useEffect(() => {
    if (cascadePrefs?.autoAssignPreferred === false) return
    if (isEditMode || preferenceCascadeAppliedRef.current) return
    if (!prefAvailability || days.length === 0) return
    if (state.preFillInstructorSlug || state.preFillVenueSlug || state.preFillBoatSlug) return

    const inst = pickFirstAvailable(
      preferredSlugsForCheck.instructor,
      prefAvailability.instructor,
    )
    const venue = pickFirstAvailable(
      preferredSlugsForCheck.venue,
      prefAvailability.venue,
    )
    const boat = pickFirstAvailable(
      preferredSlugsForCheck.boat,
      prefAvailability.boat,
    )
    if (!inst && !venue && !boat) return

    preferenceCascadeAppliedRef.current = true
    const newDays = days.map((day) => ({
      ...day,
      ...(inst ? { instructorSlug: inst } : {}),
      dives: day.dives.map((dive) => {
        const vt = dive.venueType ?? (dive.isConfined ? 'pool' : 'boat')
        const resourceId = vt === 'boat'
          ? (boat || dive.resourceId)
          : (venue || dive.resourceId)
        return { ...dive, resourceId }
      }),
    }))
    dispatch({ type: 'SET_DAYS', days: newDays })
  }, [
    isEditMode,
    prefAvailability,
    days,
    state.preFillInstructorSlug,
    state.preFillVenueSlug,
    state.preFillBoatSlug,
    preferredSlugsForCheck,
    dispatch,
    cascadePrefs?.autoAssignPreferred,
  ])

  const equipmentCascadeAppliedRef = useRef(false)
  useEffect(() => {
    if (cascadePrefs?.autoAssignPreferred === false) return
    if (isEditMode || equipmentCascadeAppliedRef.current) return
    if (!prefAvailability) return
    if (state.equipment || state.compressor) return

    const eq = pickFirstAvailable(
      preferredSlugsForCheck.equipment,
      prefAvailability.equipment,
    )
    const comp = pickFirstAvailable(
      preferredSlugsForCheck.compressor,
      prefAvailability.compressor,
    )
    if (!eq && !comp) return
    equipmentCascadeAppliedRef.current = true
    if (eq) dispatch({ type: 'SET_EQUIPMENT', value: eq })
    if (comp) dispatch({ type: 'SET_COMPRESSOR', value: comp })
  }, [
    isEditMode,
    prefAvailability,
    state.equipment,
    state.compressor,
    preferredSlugsForCheck,
    dispatch,
    cascadePrefs?.autoAssignPreferred,
  ])

  useEffect(() => {
    const assignedBoatSlugs = new Set(
      days.flatMap((d) =>
        d.dives
          .filter((dv) => (dv.venueType ?? (dv.isConfined ? 'pool' : 'boat')) === 'boat' && dv.resourceId)
          .map((dv) => dv.resourceId!),
      ),
    )
    const anyHasCompressor = boats.some(
      (b) => assignedBoatSlugs.has(b.slug) && b.hasCompressor,
    )
    if (anyHasCompressor !== state.boatHasCompressor) {
      dispatch({ type: 'SET_BOAT_HAS_COMPRESSOR', value: anyHasCompressor })
    }
  }, [days, boats, state.boatHasCompressor, dispatch])

  const allCourseCodes: CourseCode[] = [...new Set(
    customers.flatMap((c) => (c.courseEntries ?? []).map((e) => e.activityCode as CourseCode)).filter(Boolean),
  )]
  const hasDateRange = state.startDate && state.endDate

  const today = toISODateString(new Date())
  const hardErrors: string[] = []
  for (const c of sameForAll ? customers.slice(0, 1) : customers) {
    const entries = (c.courseEntries ?? []).map((e) => ({ activityCode: e.activityCode, dates: e.dates }))
    hardErrors.push(...validatePrerequisiteOrder(entries))
    hardErrors.push(...validateCourseDateOverlap(entries))
    hardErrors.push(...validateNoDuplicateCourses(entries))
    hardErrors.push(...validateStartDateNotInPast(entries, today))
  }
  const uniqueOrderingErrors = [...new Set(hardErrors)]

  const prereqWarnings = validatePrerequisites(allCourseCodes)
  const comboWarnings = validateCourseCombo(allCourseCodes)

  const diverCount = customers.length
  const instructorRatioWarnings: string[] = []
  if (diverCount > 0 && allCourseCodes.length > 0) {
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

  const allSelectedDives = days.flatMap(d => d.dives)
  const referralWarnings = detectReferralWarnings(allSelectedDives, allCourseCodes)

  const emptyDayWarnings: string[] = []
  const daysWithDives = days.filter(d => d.dives.length > 0).length
  if (days.length > 0 && daysWithDives > 0 && daysWithDives < days.length) {
    emptyDayWarnings.push(
      `${days.length} days scheduled but only ${daysWithDives} have activities. Remove empty days or adjust end date.`,
    )
  }

  const allWarnings = [...prereqWarnings, ...comboWarnings, ...instructorRatioWarnings, ...referralWarnings]

  const preFillAppliedRef = useRef(false)
  useEffect(() => {
    const key = `${[...allCourseCodes].sort().join(',')}|${state.startDate}|${state.endDate}`
    if (key === prevCoursesRef.current) return
    if (!state.startDate || !state.endDate || allCourseCodes.length === 0) return
    prevCoursesRef.current = key

    let newDays = generateDays(allCourseCodes, state.startDate, 3, state.endDate)

    if (!preFillAppliedRef.current && newDays.length > 0) {
      const { preFillInstructorSlug, preFillVenueSlug, preFillBoatSlug } = state
      if (preFillInstructorSlug || preFillVenueSlug || preFillBoatSlug) {
        preFillAppliedRef.current = true
        newDays = newDays.map((day) => ({
          ...day,
          instructorSlug: preFillInstructorSlug || day.instructorSlug,
          dives: day.dives.map((dive) => {
            const venueType = dive.venueType ?? (dive.isConfined ? 'pool' : 'boat')
            const resourceId = venueType === 'boat'
              ? (preFillBoatSlug || dive.resourceId)
              : (preFillVenueSlug || dive.resourceId)
            return { ...dive, resourceId }
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

    const exists = day.dives.some(
      (d) => d.courseCode === slot.courseCode && d.diveNumber === slot.diveNumber && d.isConfined === slot.isConfined,
    )

    let newDays: typeof days
    if (exists) {
      const sequence = buildDiveSequence(allCourseCodes)
      const clickedIdx = sequence.findIndex(s =>
        s.courseCode === slot.courseCode && s.diveNumber === slot.diveNumber && s.isConfined === slot.isConfined)

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

      newDays = cascadeRemoveOrphans(newDays, allCourseCodes)
    } else {
      if (!slot.isConfined) {
        const nonConfinedCount = day.dives.filter(d => !d.isConfined).length
        if (nonConfinedCount >= (day.divesPerDay || 3)) return
      }
      const totalDivesBefore = days.flatMap(d => d.dives).length
      newDays = days.map((d, i) => {
        if (i !== dayIndex) return d
        return { ...d, dives: [...d.dives, { courseCode: slot.courseCode, diveNumber: slot.diveNumber, isConfined: slot.isConfined, venueType: slot.isConfined ? 'pool' as const : 'boat' as const }] }
      })
      if (totalDivesBefore === 0) {
        newDays = autoDistributeFromDive(newDays, slot, allCourseCodes)
      }
    }

    dispatch({ type: 'SET_DAYS', days: newDays })
  }

  return (
    <div className="flex flex-col gap-6">
      {customers.length > 1 && (
        <div title="Coming soon">
          <Checkbox
            label={
              <>
                Same courses for all customers
                <span className="text-label px-1.5 py-0.5 rounded-[var(--border-radius-button)] text-secondary bg-glass-border">
                  Coming soon
                </span>
              </>
            }
            checked={false}
            onChange={() => {}}
            disabled
          />
        </div>
      )}

      {(sameForAll ? customers.slice(0, 1) : customers).map((customer) => (
        <div key={customer.id}>
          <div className="flex items-center justify-between mb-2">
            <h3
              className="text-body font-semibold text-primary font-heading"
            >
              {sameForAll && customers.length > 1 ? 'All customers' : customer.name}
            </h3>
            {sameForAll && customers.length > 1 && (
              <span className="text-label text-secondary">
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

          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => dispatch({ type: 'ADD_COURSE_ENTRY', customerId: customer.id })}
            className="mt-2"
          >
            <Plus size={16} />
            Add
          </Button>
        </div>
      ))}

      {uniqueOrderingErrors.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {uniqueOrderingErrors.map((error, i) => (
            <ErrorAlert key={i} icon={OctagonX} iconSize={13} size="sm">
              {error}
            </ErrorAlert>
          ))}
        </div>
      )}

      {allWarnings.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {allWarnings.map((warning, i) => (
            <ErrorAlert key={i} variant="warning" iconSize={13} size="sm">
              {warning}
            </ErrorAlert>
          ))}
        </div>
      )}

      {days.length > 0 && allCourseCodes.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3
              className="text-body font-semibold text-primary font-heading"
            >
              Schedule ({days.length} day{days.length !== 1 ? 's' : ''})
            </h3>
            <Button variant="secondary" size="sm" onClick={handleRebuild}>
              <RotateCw size={12} />
              Rebuild
            </Button>
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
              diveMasterOptions={filterByAvailability(diveMasterOptions, day.date, capacityData, inventoryMap)}
              boatOptions={enrichOptionsWithCapacity(filterByAvailability(boatOptions, day.date, capacityData, inventoryMap), day.date, capacityData, inventoryMap)}
              poolOptions={filterByAvailability(poolOptions, day.date, capacityData, inventoryMap)}
              shoreOptions={shoreOptions}
              totalDays={days.length}
              courseCodes={allCourseCodes}
              customerLanguages={customerLanguageCodes}
            />
          ))}
        </div>
      )}

      {emptyDayWarnings.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {emptyDayWarnings.map((warning, i) => (
            <ErrorAlert key={`empty-${i}`} variant="warning" iconSize={13} size="sm">
              {warning}
            </ErrorAlert>
          ))}
        </div>
      )}

      {days.length > 0 && allCourseCodes.length > 0 && (
        <ResourceStep state={state} dispatch={dispatch} />
      )}

      {customers.length === 0 && (
        <p className="text-body text-center py-6 text-secondary">
          Add customers first.
        </p>
      )}
    </div>
  )
}
