// ── Wizard State (3-step) ─────────────────────────────────────────────────────
// Replaces the old 5-step (details/divers/resources/sessions/review) wizard.
// Step structure: Customers → Itinerary → Review

import type { CourseCode } from '@/lib/constants/course-catalog'

// ── Step definition ───────────────────────────────────────────────────────────

export type WizardStep = 'customers' | 'itinerary' | 'review'

export const WIZARD_STEPS: readonly WizardStep[] = ['customers', 'itinerary', 'review']

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  customers: 'Customers',
  itinerary: 'Itinerary',
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
}

export interface DayConfig {
  date: string
  venueType: 'pool' | 'boat' | 'shore'
  dives: DiveSlot[]
  inventoryUnitId?: string
  poolInventoryUnitId?: string
  externalPoolName?: string
  instructorSlug?: string
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

  sameForAll: boolean
  saveAttempted: boolean
  submitting: boolean
  conflictError: BookingConflictDetail[] | null
  submittedBookingId: string | null
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
  | { type: 'ADD_COURSE_ENTRY'; customerId: string }
  | { type: 'REMOVE_COURSE_ENTRY'; customerId: string; entryId: string }
  | { type: 'UPDATE_COURSE_ENTRY'; customerId: string; entryId: string; patch: Partial<Omit<CourseEntry, 'id'>> }
  | { type: 'COPY_COURSE_ENTRIES_TO_ALL' }
  | { type: 'SET_AGENCY'; value: string }
  | { type: 'SET_SAME_FOR_ALL'; value: boolean }
  | { type: 'SET_DAY_INSTRUCTOR'; dayIndex: number; slug: string }
  | { type: 'UPDATE_DAY'; dayIndex: number; patch: Partial<Pick<DayConfig, 'inventoryUnitId' | 'venueType' | 'externalInstructorName' | 'externalVenueName' | 'poolInventoryUnitId' | 'externalPoolName' | 'startTime' | 'endTime'>> }
  | { type: 'APPLY_INSTRUCTOR_TO_REMAINING'; fromDayIndex: number; slug: string }
  | { type: 'APPLY_VENUE_TO_REMAINING'; fromDayIndex: number; unitId: string }
  | { type: 'REMOVE_DAY'; dayIndex: number }
  | { type: 'SET_EQUIPMENT'; value: string }
  | { type: 'SET_EQUIPMENT_EXTERNAL'; value: boolean }
  | { type: 'SET_EXTERNAL_EQUIPMENT_NAME'; value: string }
  | { type: 'SET_COMPRESSOR'; value: string }
  | { type: 'SET_COMPRESSOR_EXTERNAL'; value: boolean }
  | { type: 'SET_EXTERNAL_COMPRESSOR_NAME'; value: string }
  | { type: 'SET_SUBMITTING'; value: boolean }
  | { type: 'SET_CONFLICT_ERROR'; errors: BookingConflictDetail[] | null }
  | { type: 'SET_SUBMITTED_BOOKING_ID'; id: string }
  | { type: 'SET_SAVE_ATTEMPTED'; value: boolean }
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
    customers: [],
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
    sameForAll: true,
    saveAttempted: false,
    submitting: false,
    conflictError: null,
    submittedBookingId: null,
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
      const customers = state.customers.map((c) =>
        c.id === action.customerId
          ? { ...c, courseEntries: [...(c.courseEntries ?? []), { id: newEntryId(), activityCode: '', dates: [], agency: '' }] }
          : c,
      )
      return { ...state, customers }
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
        days: state.days.map((d, i) =>
          i >= action.fromDayIndex && d.venueType === venueType
            ? { ...d, inventoryUnitId: action.unitId, externalVenueName: sourceDay.externalVenueName }
            : d,
        ),
      }
    }

    case 'REMOVE_DAY': {
      if (state.days.length <= 1) return state
      const newDays = state.days.filter((_, i) => i !== action.dayIndex)
      const newStart = newDays[0]?.date ?? state.startDate
      const newEnd = newDays[newDays.length - 1]?.date ?? state.endDate
      return { ...state, days: newDays, startDate: newStart, endDate: newEnd }
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

    case 'SET_SUBMITTING':
      return { ...state, submitting: action.value }

    case 'SET_CONFLICT_ERROR':
      return { ...state, conflictError: action.errors }

    case 'SET_SUBMITTED_BOOKING_ID':
      return { ...state, submittedBookingId: action.id, submitting: false }

    case 'SET_SAVE_ATTEMPTED':
      return { ...state, saveAttempted: action.value }

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
  return JSON.stringify(state)
}

export function deserializeDraftState(json: string): WizardState | null {
  try {
    return JSON.parse(json) as WizardState
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
