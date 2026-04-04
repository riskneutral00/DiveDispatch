// ── Wizard State (3-step) ─────────────────────────────────────────────────────
// Step structure: Customers → Itinerary (with resources) → Review

import type { CourseCode } from '@/lib/constants/course-catalog'
import { COURSE_CATALOG } from '@/lib/constants/course-catalog'
import {
  validatePrerequisiteOrder,
  validateCourseDateOverlap,
  validateNoDuplicateCourses,
  validateStartDateNotInPast,
} from '@/lib/booking/course-validation'
import { toISODateString } from '@/lib/utils/date'

export const WIZARD_STATE_VERSION = 1

// ── Step definition ───────────────────────────────────────────────────────────

export type WizardStep = 'customers' | 'itinerary' | 'review'

export const WIZARD_STEPS: readonly WizardStep[] = ['customers', 'itinerary', 'review']

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  customers: 'Customers',
  itinerary: 'Program & Schedule',
  review: 'Review',
}

export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step)
}

// ── Inline types ──────────────────────────────────────────────────────────────

export interface CustomerContact {
  email?: string
  whatsapp?: string
  line?: string
}

export interface CourseEntry {
  id: string
  activityCode: string
  dates: string[]
  agency: string
}

export interface CustomerData {
  id: string
  name: string
  contact?: CustomerContact
  /** Language flags — code is ISO 2-letter country code, label is language name */
  flags?: { code: string; label: string }[]
  courseEntries?: CourseEntry[]
  linkSent?: boolean
}

export interface DiveSlot {
  courseCode: string
  diveNumber: number
  isConfined: boolean
  /** Per-dive venue: pool, boat, or shore. Defaults: confined → pool, non-confined → boat. */
  venueType?: 'pool' | 'boat' | 'shore'
  /** Slug of the selected resource (pool/boat/shore stakeholder). */
  resourceSlug?: string
}

export interface DayConfig {
  date: string
  /** @deprecated — venue is now per-dive (DiveSlot.venueType). Kept for backward compat. */
  venueType?: 'pool' | 'boat' | 'shore'
  dives: DiveSlot[]
  inventoryUnitId?: string
  poolInventoryUnitId?: string
  externalPoolName?: string
  instructorSlug?: string
  /** Optional dive master (assistant) — distinct from instructor; ratio rules apply. */
  diveMasterSlug?: string
  externalDiveMasterName?: string
  externalInstructorName?: string
  externalVenueName?: string
  isAutoAppended?: boolean
  divesPerDay: number
  startTime: string
  endTime: string
  timezone: string
}

export interface BookingConflictDetail {
  inventoryUnitId: string
  date: string
  reason: string
}

// ── Pre-fill payload (drag-to-date) ──────────────────────────────────────────

export interface BookingPreFill {
  courses: string[]
  startDate: string
  endDate: string
  agency: string
  instructorSlug: string
  venueSlug: string
  boatSlug: string
  equipmentSlug: string
  compressorSlug: string
  /** Optional hints from a saved booking template (merged on drag). */
  templateResourceHints?: Array<{ resourceType: string; resourceSlug: string }>
}

// ── Root state ────────────────────────────────────────────────────────────────

export interface WizardState {
  step: WizardStep
  bookingId: string | null

  customers: CustomerData[]
  activeCustomerIdx: number
  draftCreating: boolean

  selectedCourses: string[]
  startDate: string
  endDate: string
  agency: string

  days: DayConfig[]
  equipment: string
  compressor: string
  equipmentIsExternal: boolean
  compressorIsExternal: boolean
  externalEquipmentName: string
  externalCompressorName: string
  boatHasCompressor: boolean

  sameForAll: boolean
  saveAttempted: boolean
  submitting: boolean
  conflictError: BookingConflictDetail[] | null
  submittedBookingId: string | null

  /** Maps resource owner slug → inventory unit Convex doc ID.
   *  Populated by the itinerary step from listInventoryByType queries.
   *  Used by the review step to build sessions with correct inventory unit IDs. */
  inventoryUnitMap: Record<string, string>

  /** Pre-fill hints from drag-to-date — itinerary step uses these to default-select resources */
  preFillInstructorSlug?: string
  preFillVenueSlug?: string
  preFillBoatSlug?: string

  /** Referral booking owner slug — load cascade prefs via stakeholderPreferences.bySlug (DD-317) */
  referralOwnerSlug?: string
}

// ── Actions ───────────────────────────────────────────────────────────────────

export type WizardAction =
  | { type: 'SET_STEP'; payload: WizardStep }
  | { type: 'SET_BOOKING_ID'; payload: string }
  | { type: 'SET_DRAFT_CREATING'; value: boolean }
  | { type: 'ADD_CUSTOMER'; customer: CustomerData }
  | { type: 'UPDATE_CUSTOMER'; id: string; updates: Partial<CustomerData> }
  | { type: 'REMOVE_CUSTOMER'; id: string }
  | { type: 'SET_ACTIVE_CUSTOMER_IDX'; index: number }
  | { type: 'MARK_CUSTOMER_LINK_SENT'; customerId: string }
  | { type: 'ADD_COURSE_ENTRY'; customerId: string; initialData?: Partial<Omit<CourseEntry, 'id'>> }
  | { type: 'REMOVE_COURSE_ENTRY'; customerId: string; entryId: string }
  | { type: 'UPDATE_COURSE_ENTRY'; customerId: string; entryId: string; patch: Partial<Omit<CourseEntry, 'id'>> }
  | { type: 'COPY_COURSE_ENTRIES_TO_ALL' }
  | { type: 'SET_AGENCY'; value: string }
  | { type: 'SET_SAME_FOR_ALL'; value: boolean }
  | { type: 'SET_DAY_INSTRUCTOR'; dayIndex: number; slug: string }
  | { type: 'SET_DAY_DIVE_MASTER'; dayIndex: number; slug: string }
  | { type: 'UPDATE_DAY'; dayIndex: number; patch: Partial<Pick<DayConfig, 'inventoryUnitId' | 'venueType' | 'externalInstructorName' | 'externalVenueName' | 'externalDiveMasterName' | 'poolInventoryUnitId' | 'externalPoolName' | 'startTime' | 'endTime'>> }
  | { type: 'APPLY_INSTRUCTOR_TO_REMAINING'; fromDayIndex: number; slug: string }
  | { type: 'APPLY_VENUE_TO_REMAINING'; fromDayIndex: number; unitId: string }
  | { type: 'REMOVE_DAY'; dayIndex: number }
  | { type: 'SET_EQUIPMENT'; value: string }
  | { type: 'SET_EQUIPMENT_EXTERNAL'; value: boolean }
  | { type: 'SET_EXTERNAL_EQUIPMENT_NAME'; value: string }
  | { type: 'SET_COMPRESSOR'; value: string }
  | { type: 'SET_COMPRESSOR_EXTERNAL'; value: boolean }
  | { type: 'SET_EXTERNAL_COMPRESSOR_NAME'; value: string }
  | { type: 'SET_BOAT_HAS_COMPRESSOR'; value: boolean }
  | { type: 'SET_SUBMITTING'; value: boolean }
  | { type: 'SET_CONFLICT_ERROR'; errors: BookingConflictDetail[] | null }
  | { type: 'SET_SUBMITTED_BOOKING_ID'; id: string }
  | { type: 'SET_SAVE_ATTEMPTED'; value: boolean }
  | { type: 'TOGGLE_DIVE'; dayIndex: number; slot: DiveSlot }
  | { type: 'SET_DAYS'; days: DayConfig[] }
  | { type: 'SET_DIVE_VENUE'; dayIndex: number; diveIndex: number; venueType: 'pool' | 'boat' | 'shore'; resourceSlug?: string }
  | { type: 'APPLY_DIVE_RESOURCE_TO_REMAINING'; fromDayIndex: number; venueType: 'pool' | 'boat' | 'shore'; resourceSlug: string }
  | { type: 'SET_INVENTORY_MAP'; map: Record<string, string> }
  | { type: 'RESET'; payload?: Partial<WizardState> }

// ── Helpers ───────────────────────────────────────────────────────────────────

function newEntryId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function deriveDates(customers: CustomerData[]): { startDate: string; endDate: string } {
  const allDates = customers.flatMap((c) => (c.courseEntries ?? []).flatMap((e) => e.dates))
  if (allDates.length === 0) return { startDate: '', endDate: '' }
  const sorted = [...allDates].sort()
  return { startDate: sorted[0], endDate: sorted[sorted.length - 1] }
}

function deriveSelectedCourses(customers: CustomerData[]): string[] {
  const codes = new Set<string>()
  customers.forEach((c) => (c.courseEntries ?? []).forEach((e) => e.activityCode && codes.add(e.activityCode)))
  return Array.from(codes)
}

// ── Initial state ─────────────────────────────────────────────────────────────

export function makeInitialState(bookingId: string | null = null): WizardState {
  return {
    step: 'customers',
    bookingId,
    customers: [{
      id: newEntryId(),
      name: '',
      contact: {},
      flags: [],
      courseEntries: [{ id: newEntryId(), activityCode: '', dates: [], agency: '' }],
    }],
    activeCustomerIdx: 0,
    draftCreating: false,
    selectedCourses: [],
    startDate: '',
    endDate: '',
    agency: '',
    days: [],
    equipment: '',
    compressor: '',
    equipmentIsExternal: false,
    compressorIsExternal: false,
    externalEquipmentName: '',
    externalCompressorName: '',
    boatHasCompressor: false,
    sameForAll: true,
    saveAttempted: false,
    submitting: false,
    conflictError: null,
    submittedBookingId: null,
    inventoryUnitMap: {},
    preFillInstructorSlug: undefined,
    preFillVenueSlug: undefined,
    preFillBoatSlug: undefined,
    referralOwnerSlug: undefined,
  }
}

// ── Reducer ───────────────────────────────────────────────────────────────────

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload }

    case 'SET_BOOKING_ID':
      return { ...state, bookingId: action.payload }

    case 'SET_DRAFT_CREATING':
      return { ...state, draftCreating: action.value }

    case 'ADD_CUSTOMER': {
      const next = [...state.customers, action.customer]
      return { ...state, customers: next, activeCustomerIdx: next.length - 1 }
    }

    case 'UPDATE_CUSTOMER':
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === action.id ? { ...c, ...action.updates } : c,
        ),
      }

    case 'REMOVE_CUSTOMER': {
      const next = state.customers.filter((c) => c.id !== action.id)
      return {
        ...state,
        customers: next,
        activeCustomerIdx: Math.max(0, Math.min(state.activeCustomerIdx, next.length - 1)),
      }
    }

    case 'SET_ACTIVE_CUSTOMER_IDX':
      return { ...state, activeCustomerIdx: action.index }

    case 'MARK_CUSTOMER_LINK_SENT':
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === action.customerId ? { ...c, linkSent: true } : c,
        ),
      }

    case 'ADD_COURSE_ENTRY': {
      const init = action.initialData ?? {}
      const customers = state.customers.map((c) =>
        c.id === action.customerId
          ? { ...c, courseEntries: [...(c.courseEntries ?? []), { id: newEntryId(), activityCode: '', dates: [], agency: '', ...init }] }
          : c,
      )
      const derived = deriveDates(customers)
      return { ...state, customers, ...derived, selectedCourses: deriveSelectedCourses(customers) }
    }

    case 'REMOVE_COURSE_ENTRY': {
      const customers = state.customers.map((c) => {
        if (c.id !== action.customerId) return c
        const entries = (c.courseEntries ?? []).filter((e) => e.id !== action.entryId)
        return { ...c, courseEntries: entries.length > 0 ? entries : c.courseEntries }
      })
      const derived = deriveDates(customers)
      return { ...state, customers, ...derived, selectedCourses: deriveSelectedCourses(customers) }
    }

    case 'UPDATE_COURSE_ENTRY': {
      const customers = state.customers.map((c) => {
        if (c.id !== action.customerId) return c
        return {
          ...c,
          courseEntries: (c.courseEntries ?? []).map((e) =>
            e.id === action.entryId ? { ...e, ...action.patch } : e,
          ),
        }
      })
      const derived = deriveDates(customers)
      return { ...state, customers, ...derived, selectedCourses: deriveSelectedCourses(customers) }
    }

    case 'COPY_COURSE_ENTRIES_TO_ALL': {
      const source = state.customers[0]?.courseEntries ?? []
      const customers = state.customers.map((c, i) =>
        i === 0 ? c : { ...c, courseEntries: source.map((e) => ({ ...e, id: newEntryId() })) },
      )
      const derived = deriveDates(customers)
      return { ...state, customers, ...derived, selectedCourses: deriveSelectedCourses(customers) }
    }

    case 'SET_AGENCY':
      return { ...state, agency: action.value }

    case 'SET_SAME_FOR_ALL':
      return { ...state, sameForAll: action.value }

    case 'SET_DAY_INSTRUCTOR':
      return {
        ...state,
        days: state.days.map((d, i) =>
          i === action.dayIndex ? { ...d, instructorSlug: action.slug } : d,
        ),
      }

    case 'SET_DAY_DIVE_MASTER':
      return {
        ...state,
        days: state.days.map((d, i) =>
          i === action.dayIndex
            ? {
                ...d,
                diveMasterSlug: action.slug === '' ? undefined : action.slug,
                externalDiveMasterName:
                  action.slug === '' || (action.slug && action.slug !== '__external__')
                    ? undefined
                    : d.externalDiveMasterName,
              }
            : d,
        ),
      }

    case 'UPDATE_DAY':
      return {
        ...state,
        days: state.days.map((d, i) => (i === action.dayIndex ? { ...d, ...action.patch } : d)),
      }

    case 'APPLY_INSTRUCTOR_TO_REMAINING':
      return {
        ...state,
        days: state.days.map((d, i) =>
          i >= action.fromDayIndex ? { ...d, instructorSlug: action.slug } : d,
        ),
      }

    case 'APPLY_VENUE_TO_REMAINING': {
      const sourceDay = state.days[action.fromDayIndex]
      if (!sourceDay) return state
      const venueType = sourceDay.venueType
      return {
        ...state,
        days: state.days.map((d, i) => {
          if (i < action.fromDayIndex || d.venueType !== venueType) return d
          if (venueType === 'pool') {
            return { ...d, poolInventoryUnitId: action.unitId, externalPoolName: sourceDay.externalPoolName }
          }
          return { ...d, inventoryUnitId: action.unitId, externalVenueName: sourceDay.externalVenueName }
        }),
      }
    }

    case 'REMOVE_DAY': {
      if (state.days.length <= 1) return state
      const newDays = state.days.filter((_, i) => i !== action.dayIndex)
      // Don't update startDate/endDate — those are the user's chosen date range.
      // Changing them triggers the useEffect in itinerary-step that calls generateDays(),
      // which would wipe all configured dives/instructors/venues.
      return { ...state, days: newDays }
    }

    case 'SET_EQUIPMENT':
      return { ...state, equipment: action.value }

    case 'SET_EQUIPMENT_EXTERNAL':
      return { ...state, equipmentIsExternal: action.value }

    case 'SET_EXTERNAL_EQUIPMENT_NAME':
      return { ...state, externalEquipmentName: action.value }

    case 'SET_COMPRESSOR':
      return { ...state, compressor: action.value }

    case 'SET_COMPRESSOR_EXTERNAL':
      return { ...state, compressorIsExternal: action.value }

    case 'SET_EXTERNAL_COMPRESSOR_NAME':
      return { ...state, externalCompressorName: action.value }

    case 'SET_BOAT_HAS_COMPRESSOR':
      return { ...state, boatHasCompressor: action.value }

    case 'SET_SUBMITTING':
      return { ...state, submitting: action.value }

    case 'SET_CONFLICT_ERROR':
      return { ...state, conflictError: action.errors }

    case 'SET_SUBMITTED_BOOKING_ID':
      return { ...state, submittedBookingId: action.id, submitting: false }

    case 'SET_SAVE_ATTEMPTED':
      return { ...state, saveAttempted: action.value }

    case 'TOGGLE_DIVE': {
      const day = state.days[action.dayIndex]
      if (!day) return state
      const exists = day.dives.some(
        (d) =>
          d.courseCode === action.slot.courseCode &&
          d.diveNumber === action.slot.diveNumber &&
          d.isConfined === action.slot.isConfined,
      )
      const newDives = exists
        ? day.dives.filter(
            (d) =>
              !(
                d.courseCode === action.slot.courseCode &&
                d.diveNumber === action.slot.diveNumber &&
                d.isConfined === action.slot.isConfined
              ),
          )
        : [...day.dives, action.slot]
      return {
        ...state,
        days: state.days.map((d, i) =>
          i === action.dayIndex ? { ...d, dives: newDives } : d,
        ),
      }
    }

    case 'SET_DAYS':
      return { ...state, days: action.days }

    case 'SET_DIVE_VENUE': {
      const day = state.days[action.dayIndex]
      if (!day) return state
      const dive = day.dives[action.diveIndex]
      if (!dive) return state
      const updatedDive = { ...dive, venueType: action.venueType, resourceSlug: action.resourceSlug }
      const newDives = day.dives.map((d, i) => (i === action.diveIndex ? updatedDive : d))
      return {
        ...state,
        days: state.days.map((d, i) => (i === action.dayIndex ? { ...d, dives: newDives } : d)),
      }
    }

    case 'APPLY_DIVE_RESOURCE_TO_REMAINING': {
      return {
        ...state,
        days: state.days.map((d, i) => {
          if (i < action.fromDayIndex) return d
          return {
            ...d,
            dives: d.dives.map(dive => {
              const diveVenue = dive.venueType ?? (dive.isConfined ? 'pool' : 'boat')
              if (diveVenue === action.venueType && !dive.resourceSlug) {
                return { ...dive, resourceSlug: action.resourceSlug }
              }
              return dive
            }),
          }
        }),
      }
    }

    case 'SET_INVENTORY_MAP':
      return { ...state, inventoryUnitMap: action.map }

    case 'RESET':
      return action.payload
        ? { ...makeInitialState(null), ...action.payload }
        : makeInitialState(null)

    default:
      return state
  }
}

// ── Serialization ─────────────────────────────────────────────────────────────

export function serializeDraftState(state: WizardState): string {
  return JSON.stringify({ ...state, _v: WIZARD_STATE_VERSION })
}

export function deserializeDraftState(json: string): WizardState | null {
  try {
    const parsed = JSON.parse(json)
    if (parsed._v !== WIZARD_STATE_VERSION) return null
    const { _v, ...rest } = parsed
    const defaults = makeInitialState(rest.bookingId ?? null)
    return { ...defaults, ...rest } as WizardState
  } catch {
    return null
  }
}

// ── Derived helpers ───────────────────────────────────────────────────────────

/** Returns instructorSlug common to the most days (for booking-level resource). */
export function getPrimaryInstructorSlug(days: DayConfig[]): string | undefined {
  const counts = new Map<string, number>()
  for (const d of days) {
    if (d.instructorSlug && d.instructorSlug !== '__external__') {
      counts.set(d.instructorSlug, (counts.get(d.instructorSlug) ?? 0) + 1)
    }
  }
  let best: string | undefined
  let bestCount = 0
  for (const [slug, count] of counts) {
    if (count > bestCount) {
      best = slug
      bestCount = count
    }
  }
  return best
}

/** Derive CourseCode[] from customers' courseEntries for submitToDraft. */
export function deriveActivityType(customers: CustomerData[]): CourseCode[] {
  const codes = new Set<string>()
  customers.forEach((c) =>
    (c.courseEntries ?? []).forEach((e) => {
      if (e.activityCode) codes.add(e.activityCode)
    }),
  )
  return Array.from(codes) as CourseCode[]
}

// ── Validation Gates ─────────────────────────────────────────────────────────

/** Format validators for contact fields. */
export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}
export function isValidWhatsApp(v: string): boolean {
  return /^\+?[\d\s\-().]{7,}$/.test(v)
}
export function isValidLine(v: string): boolean {
  return /^[a-zA-Z0-9._]{4,}$/.test(v)
}

/** Check that a customer has at least one valid contact. */
function hasValidContact(c: CustomerData): boolean {
  if (!c.contact) return false
  if (c.contact.email && isValidEmail(c.contact.email)) return true
  if (c.contact.whatsapp && isValidWhatsApp(c.contact.whatsapp)) return true
  if (c.contact.line && isValidLine(c.contact.line)) return true
  return false
}

export function canAdvanceFromCustomers(customers: CustomerData[]): boolean {
  if (customers.length === 0) return false
  return customers.every(
    (c) =>
      c.name.trim().length > 0 &&
      hasValidContact(c) &&
      (c.flags?.length ?? 0) > 0,
  )
}

/** Check all required fields for Step 2 (Itinerary + Resources). */
export function canAdvanceFromItinerary(state: WizardState): boolean {
  // When sameForAll is on, only customer[0] has courses — the rest get copied on advance
  const courseCustomers = state.sameForAll ? state.customers.slice(0, 1) : state.customers

  // Every diver has at least one course selected
  const allHaveCourse = courseCustomers.every((c) =>
    (c.courseEntries ?? []).some((e) => e.activityCode.length > 0),
  )
  if (!allHaveCourse) return false

  // Must have days
  if (state.days.length === 0) return false

  // No empty days (every day has at least one dive)
  if (state.days.some((d) => d.dives.length === 0)) return false

  // Per-customer validation
  for (const customer of courseCustomers) {
    const entries = (customer.courseEntries ?? []).map((e) => ({
      activityCode: e.activityCode,
      dates: e.dates,
    }))
    const courseCodes = entries.map((e) => e.activityCode).filter(Boolean)

    // No prerequisite ordering errors
    if (validatePrerequisiteOrder(entries).length > 0) return false

    // B1: No overlapping course dates (shared transition day is allowed)
    if (validateCourseDateOverlap(entries).length > 0) return false

    // B4: No duplicate course codes per customer
    if (validateNoDuplicateCourses(entries).length > 0) return false


    // Past dates — cannot start a course before today
    if (validateStartDateNotInPast(entries, toISODateString(new Date())).length > 0) return false
  }

  // B3: Per-day non-confined dive count cap (max divesPerDay, default 3)
  for (const day of state.days) {
    const nonConfinedCount = day.dives.filter((d) => !d.isConfined).length
    if (nonConfinedCount > (day.divesPerDay || 3)) return false
  }

  // O+A combo: OW-4 and AOW-1 must be selected somewhere
  const allCodesSet = new Set(
    courseCustomers.flatMap((c) => (c.courseEntries ?? []).map((e) => e.activityCode)).filter(Boolean),
  )
  if (allCodesSet.has('OW') && allCodesSet.has('AOW')) {
    const allDives = state.days.flatMap((d) => d.dives)
    const hasOW4 = allDives.some((d) => d.courseCode === 'OW' && d.diveNumber === 4 && !d.isConfined)
    const hasAOW1 = allDives.some((d) => d.courseCode === 'AOW' && d.diveNumber === 1 && !d.isConfined)
    if (!hasOW4 || !hasAOW1) return false
  }

  // Instructor ratio: enough instructors/DMs for the diver count?
  const allCourseCodes = [...new Set(
    courseCustomers.flatMap((c) => (c.courseEntries ?? []).map((e) => e.activityCode)).filter(Boolean),
  )]
  if (allCourseCodes.length > 0 && state.customers.length > 0) {
    let minRatio = Infinity
    for (const code of allCourseCodes) {
      const entry = COURSE_CATALOG.find((c) => c.code === code)
      if (entry && entry.maxDiversPerInstructor < minRatio) {
        minRatio = entry.maxDiversPerInstructor
      }
    }
    if (minRatio < Infinity && state.customers.length > minRatio) {
      const requiredInstructors = Math.ceil(state.customers.length / minRatio)
      // Count unique instructors assigned across all days (system slugs + external names)
      const uniqueInstructors = new Set<string>()
      for (const day of state.days) {
        if (day.instructorSlug && day.instructorSlug !== '__external__') {
          uniqueInstructors.add(day.instructorSlug)
        } else if (day.instructorSlug === '__external__' && day.externalInstructorName?.trim()) {
          uniqueInstructors.add(`ext:${day.externalInstructorName.trim().toLowerCase()}`)
        }
      }
      if (uniqueInstructors.size < requiredInstructors) return false
    }
  }

  // Resource checks (merged from canAdvanceFromResources — resources now live in itinerary step)
  for (const day of state.days) {
    // Every day needs an instructor (system or external)
    const hasInstructor =
      (day.instructorSlug && day.instructorSlug !== '__external__') ||
      (day.instructorSlug === '__external__' && day.externalInstructorName?.trim())
    if (!hasInstructor) return false

    // Every dive with a venue type must have a resource selected
    for (const dive of day.dives) {
      if (dive.venueType && !dive.resourceSlug) return false
    }
  }

  // Equipment manager required (system or external with name)
  const hasEquipment = (state.equipment && state.equipment !== '__external__') ||
    (state.equipment === '__external__' && state.externalEquipmentName?.trim())
  if (!hasEquipment) return false

  // Compressor required — skip if selected boat has on-board compressor
  if (!state.boatHasCompressor) {
    const hasCompressor = (state.compressor && state.compressor !== '__external__') ||
      (state.compressor === '__external__' && state.externalCompressorName?.trim())
    if (!hasCompressor) return false
  }

  return true
}

/** Check all required fields for resources (instructor + venue per day).
 * @deprecated Resources are now validated in canAdvanceFromItinerary.
 * Kept for backward compatibility.
 */
export function canAdvanceFromResources(state: WizardState): boolean {
  for (const day of state.days) {
    // Every day needs an instructor (system or external)
    const hasInstructor =
      (day.instructorSlug && day.instructorSlug !== '__external__') ||
      (day.instructorSlug === '__external__' && day.externalInstructorName?.trim())
    if (!hasInstructor) return false
  }

  return true
}
