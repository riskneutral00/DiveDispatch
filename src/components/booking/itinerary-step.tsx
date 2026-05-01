'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { useWizardPreferences } from '@/lib/hooks/use-wizard-preferences'
import { useDirectoryByRoleKey } from '@/lib/hooks/use-directory-by-role-key'
import { Button, Checkbox, SimpleSelect, ErrorAlert, FieldRow } from '@/components/ui'
import { CardTitle } from '@/components/ui/card-title'
import { DateField } from '@/components/ui/date-field'
import { DayRow } from './day-row'
import { ResourceStep } from './resource-step'
import { generateDays, getAvailableDives, autoDistributeFromDive, buildDiveSequence, cascadeRemoveOrphans } from '@/lib/booking/generate-days'
import { getEndDateDefault, validatePrerequisites, validatePrerequisiteOrder, validateCourseCombo, validateCourseDateOverlap, validateNoDuplicateCourses, validateStartDateNotInPast, calculateComboDates, getUnavailableCodes, detectReferralWarnings } from '@/lib/booking/activity-validation'
import { getTodayISO } from '@/lib/utils/date'
import { TextChip } from '@/components/ui/text-chip'
import type { WizardState, WizardAction, CourseEntry, DiveSlot } from '@/lib/booking/wizard-state'
import type { CourseCode } from '@/lib/constants/course-catalog'
import { COURSE_CATALOG, COURSE_DISPLAY_LABELS, COMBO_COURSES, COURSE_CODES } from '@/lib/constants/course-catalog'
import { addDays } from '@/lib/utils/date'
import type { Dispatch } from 'react'
import { Copy, OctagonX, Plus, RotateCw, Trash2 } from 'lucide-react'
import { staffCanConductActivity, type Credential } from '../../../convex/shared/capabilityGate'
import type { ActivityCode } from '../../../convex/shared/activityCatalog'

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
  const tItin = useTranslations('booking.itinerary')
  const tCommon = useTranslations('common')
  const agencyCodes = agency
    ? COURSE_CATALOG.filter((c) => c.agency === agency).map((c) => c.code)
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
      <div className="flex items-end gap-2">
        <FieldRow className="flex-1" density="compact">
          <SimpleSelect
            className="field-md"
            label={tItin('activity')}
            value={entry.activityCode}
            onChange={handleCourseChange}
            data-testid="course-activity-select"
            options={[
              ...uniqueCodes.map((code) => ({ value: code, label: COURSE_DISPLAY_LABELS[code] })),
              { value: '──────────', label: '──────────', disabled: true },
              { value: 'O+A', label: COMBO_COURSES['O+A'].label },
            ]}
            placeholder={tItin('selectActivity')}
          />
          <DateField
            className="field-md min-w-0 reading-plane rounded-theme p-2"
            label={tCommon('startDate')}
            value={entry.dates[0] ?? null}
            min={minStartDate}
            onChange={(v) => handleStartDateChange(v ?? '')}
            data-testid="course-start-date"
            required
          />
          <DateField
            className="field-md min-w-0 reading-plane rounded-theme p-2"
            label={tCommon('endDate')}
            value={entry.dates[1] ?? entry.dates[0] ?? null}
            min={entry.dates[0]}
            onChange={(v) => handleEndDateChange(v ?? '')}
            required
          />
        </FieldRow>
        {canRemove && (
          <Button
            variant="destructive-ghost"
            size="sm"
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_COURSE_ENTRY', customerId, entryId: entry.id })}
            aria-label={tItin('removeCourseAriaLabel')}
          >
            <Trash2 size={16} />
          </Button>
        )}
      </div>
    </div>
  )
}

import { filterByAvailability, enrichOptionsWithCapacity } from '@/lib/booking/availability-filter'

// query-budget-ok: 11 subscriptions; planned migration to itinerary.wizardContext (Phase 2A of zesty-creek perf plan)
export function ItineraryStep({ state, dispatch, isEditMode = false }: ItineraryStepProps) {
  const tItin = useTranslations('booking.itinerary')
  const tCommon = useTranslations('common')
  const { customers, days, agency, sameForAll } = state
  const prevCoursesRef = useRef<string>('')

  const instructorsRaw = useDirectoryByRoleKey('instructor')
  const boatsRaw = useDirectoryByRoleKey('boat')
  const venuesRaw = useDirectoryByRoleKey('venue')
  const shoreOptionsRaw = useQuery(api.availability.listVenues)
  const instructors = useMemo(() => instructorsRaw ?? [], [instructorsRaw])
  const boats = useMemo(() => boatsRaw ?? [], [boatsRaw])
  const poolVenues = useMemo(() => venuesRaw?.filter((r) => r.kind === 'pool') ?? [], [venuesRaw])
  const shoreOptions = useMemo(() => shoreOptionsRaw ?? [], [shoreOptionsRaw])
  const instructorOptions = instructors.map((r) => ({ id: r.slug, label: r.name, languages: r.languages, isPreferred: r.isPreferred }))
  const diveMasterOptions = instructorOptions
  const customerLanguageCodes = customers.flatMap(c => (c.flags ?? []).map(f => f.code))
  const boatOptions = boats.map((r) => ({ id: r.slug, label: r.name }))
  const poolVenueOptions = poolVenues.map((r) => ({ id: r.slug, label: r.name }))

  const credentialsBySlug = useMemo(() => {
    const map = new Map<string, Credential[]>()
    for (const r of instructors) {
      if (r.credentials) {
        map.set(r.slug, r.credentials.map((c) => ({
          agency: c.agency,
          level: c.level,
          specialtyRatings: c.specialtyRatings,
        })))
      }
    }
    return map
  }, [instructors])

  const allSpecialtyCodes = useMemo(
    () => [...new Set(customers.flatMap((c) => (c.courseEntries ?? []).filter((e) => e.activityCode === 'SPECIALTY' && e.specialtyCode).map((e) => e.specialtyCode!)))],
    [customers],
  )

  const capabilityWarnings = useMemo(() => {
    const warnings: Record<number, string> = {}
    for (let i = 0; i < days.length; i++) {
      const day = days[i]
      const slug = day.instructorSlug
      if (!slug || slug === '__external__') continue
      const creds = credentialsBySlug.get(slug)
      if (!creds || creds.length === 0) continue
      const dayCodes = [...new Set(day.dives.map((d) => d.courseCode))] as ActivityCode[]
      let warned = false
      for (const code of dayCodes) {
        if (code === 'SPECIALTY' && allSpecialtyCodes.length > 0) {
          for (const sc of allSpecialtyCodes) {
            const result = staffCanConductActivity(creds, code, sc)
            if (!result.allowed) {
              warnings[i] = result.reason?.detail ?? 'Credential mismatch'
              warned = true
              break
            }
          }
        } else {
          const result = staffCanConductActivity(creds, code)
          if (!result.allowed) {
            warnings[i] = result.reason?.detail ?? 'Credential mismatch'
            warned = true
          }
        }
        if (warned) break
      }
    }
    return warnings
  }, [days, credentialsBySlug, allSpecialtyCodes])

  const instructorInventoryRaw = useQuery(api.availability.listInventoryByType, { type: 'Instructor' })
  const boatInventoryRaw = useQuery(api.availability.listInventoryByType, { type: 'Boat' })
  const poolInventoryRaw = useQuery(api.availability.listInventoryByType, { type: 'Venue' })
  const instructorInventory = useMemo(() => instructorInventoryRaw ?? [], [instructorInventoryRaw])
  const boatInventory = useMemo(() => boatInventoryRaw ?? [], [boatInventoryRaw])
  const poolInventory = useMemo(() => poolInventoryRaw ?? [], [poolInventoryRaw])
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

  const targetOperatorSlug = state.isReferral ? (state.targetOperatorSlug ?? null) : null
  const { prefs: cascadePrefs, isLoading: cascadePrefsLoading } = useWizardPreferences(targetOperatorSlug)

  const operatorDirectoryRaw = useDirectoryByRoleKey('dive-center')
  const operatorDirectory = useMemo(() => operatorDirectoryRaw ?? [], [operatorDirectoryRaw])
  const targetOperatorOptions = useMemo(
    () => operatorDirectory
      .map((e) => ({ value: e.slug, label: `${e.name} — ${e.placeName}` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [operatorDirectory],
  )

  const minePrefsForDefault = useQuery(api.stakeholderPreferences.mine)
  const preferredOperatorSlug = minePrefsForDefault?.preferredOperatorSlug
  useEffect(() => {
    if (state.isReferral && !state.targetOperatorSlug && preferredOperatorSlug) {
      dispatch({ type: 'SET_TARGET_OPERATOR_SLUG', value: preferredOperatorSlug })
    }
  }, [state.isReferral, state.targetOperatorSlug, preferredOperatorSlug, dispatch])

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

  const allCourseCodes: CourseCode[] = useMemo(
    () => [...new Set(
      customers.flatMap((c) => (c.courseEntries ?? []).map((e) => e.activityCode as CourseCode)).filter(Boolean),
    )],
    [customers],
  )
  const cascadeKey = `${targetOperatorSlug ?? ''}|${state.startDate}|${state.endDate}|${[...allCourseCodes].sort().join(',')}`
  const lastCascadeKeyRef = useRef<string>('')
  useEffect(() => {
    if (cascadePrefs?.autoAssignPreferred === false) return
    if (isEditMode) return
    if (!prefAvailability || days.length === 0) return
    if (cascadeKey === lastCascadeKeyRef.current) return
    if (state.preFillInstructorSlug || state.preFillVenueSlug || state.preFillBoatSlug) return

    lastCascadeKeyRef.current = cascadeKey

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
    const eq = pickFirstAvailable(
      preferredSlugsForCheck.equipment,
      prefAvailability.equipment,
    )
    const comp = pickFirstAvailable(
      preferredSlugsForCheck.compressor,
      prefAvailability.compressor,
    )

    const newDays = days.map((day) => ({
      ...day,
      instructorSlug: day.instructorSlug || inst || undefined,
      dives: day.dives.map((dive) => {
        const vt = dive.venueType ?? (dive.isConfined ? 'pool' : 'boat')
        const fallback = vt === 'boat' ? boat : venue
        return { ...dive, resourceId: dive.resourceId || fallback || undefined }
      }),
    }))
    dispatch({ type: 'SET_DAYS', days: newDays })
    if (!state.equipment && eq) dispatch({ type: 'SET_EQUIPMENT', value: eq })
    if (!state.compressor && comp) dispatch({ type: 'SET_COMPRESSOR', value: comp })
  }, [
    isEditMode,
    prefAvailability,
    days,
    cascadeKey,
    state.preFillInstructorSlug,
    state.preFillVenueSlug,
    state.preFillBoatSlug,
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

  const hasDateRange = state.startDate && state.endDate

  const today = getTodayISO()
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
    const ADMIN_MAX_DIVERS_PER_INSTRUCTOR = 4
    if (diverCount > ADMIN_MAX_DIVERS_PER_INSTRUCTOR) {
      const requiredInstructors = Math.ceil(diverCount / ADMIN_MAX_DIVERS_PER_INSTRUCTOR)
      instructorRatioWarnings.push(
        `${diverCount} divers with max ${ADMIN_MAX_DIVERS_PER_INSTRUCTOR} per instructor — minimum ${requiredInstructors} instructors/DMs required.`,
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
      const preFillInstructorSlug = state.preFillInstructorSlug
      const preFillVenueSlug = state.preFillVenueSlug
      const preFillBoatSlug = state.preFillBoatSlug
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
      <div className="flex flex-col gap-3 p-3 rounded-theme glass-container">
        <Checkbox
          label={tItin('referLabel')}
          checked={state.isReferral}
          onChange={(checked) => dispatch({ type: 'SET_IS_REFERRAL', value: checked })}
          data-testid="referral-mode-toggle"
        />
        <SimpleSelect
          label={tItin('targetDiveCenter')}
          value={state.targetOperatorSlug ?? ''}
          disabled={!state.isReferral}
          onChange={(v) => dispatch({ type: 'SET_TARGET_OPERATOR_SLUG', value: v || undefined })}
          options={targetOperatorOptions}
          placeholder={tItin('selectOperator')}
          data-testid="referral-target-select"
        />
        {state.isReferral && !state.targetOperatorSlug && (
          <p className="text-label text-warning">{tItin('selectOperatorFirst')}</p>
        )}
      </div>

      {customers.length > 1 && (
        <div title={tCommon('comingSoon')}>
          <Checkbox
            label={
              <>
                {tItin('sameCoursesLabel')}
                <TextChip tone="muted">
                  {tCommon('comingSoon')}
                </TextChip>
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
            <CardTitle as="h3" size="sm">
              {sameForAll && customers.length > 1 ? tItin('allCustomers') : customer.name}
            </CardTitle>
            {sameForAll && customers.length > 1 && (
              <span className="text-label text-secondary">
                <Copy size={10} className="inline mr-1" />
                {tItin('appliesToCustomers', { count: customers.length })}
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
            {tCommon('add')}
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
            <CardTitle as="h3" size="sm">
              {tItin('scheduleDays', { count: days.length })}
            </CardTitle>
            <Button variant="secondary" size="sm" onClick={handleRebuild}>
              <RotateCw size={12} />
              {tItin('rebuild')}
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
              poolOptions={filterByAvailability(poolVenueOptions, day.date, capacityData, inventoryMap)}
              shoreOptions={shoreOptions}
              totalDays={days.length}
              courseCodes={allCourseCodes}
              customerLanguages={customerLanguageCodes}
              capabilityWarning={capabilityWarnings[idx]}
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
          {tItin('addCustomersFirst')}
        </p>
      )}
    </div>
  )
}
