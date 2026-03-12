import type { CourseCode } from '@/lib/constants/course-catalog'

// ── Step definition ───────────────────────────────────────────────────────────

export type WizardStep = 'details' | 'divers' | 'resources' | 'sessions' | 'review'

export const WIZARD_STEPS: readonly WizardStep[] = ['details', 'divers', 'resources', 'sessions', 'review']

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  details: 'Details',
  divers: 'Divers',
  resources: 'Resources',
  sessions: 'Sessions',
  review: 'Review',
}

// ── Slice types ───────────────────────────────────────────────────────────────

export interface DiverEntry {
  name: string
  abbrev: string
  flag: { code: string; label: string }
  startDate: string
  endDate: string
  agency?: string
  activityType: CourseCode[]
}

export interface DetailsState {
  activityType: CourseCode[]
  startDate: string
  endDate: string
  portalContact: boolean
  portalMedical: boolean
  portalWaiver: boolean
}

export interface ResourcesState {
  instructorId?: string
  boatId?: string
  equipmentManagerId?: string
  poolId?: string
  compressorId?: string
  agentId?: string
  agentIsReferral?: boolean
  externalStakeholders?: {
    instructorName?: string
    boatName?: string
    equipmentManagerName?: string
    poolName?: string
    compressorName?: string
  }
}

export interface SessionEntry {
  inventoryUnitId: string
  date: string
  startTime: string
  endTime: string
  timezone: string
  unitsRequested: number
  deliveryLocation?: 'BoatPier' | 'Pool' | 'Beach'
}

// ── Root state ────────────────────────────────────────────────────────────────

export interface WizardState {
  step: WizardStep
  bookingId: string | null
  details: DetailsState
  divers: DiverEntry[]
  resources: ResourcesState
  sessions: SessionEntry[]
}

// ── Actions ───────────────────────────────────────────────────────────────────

export type WizardAction =
  | { type: 'SET_STEP'; payload: WizardStep }
  | { type: 'SET_BOOKING_ID'; payload: string }
  | { type: 'UPDATE_FIELD'; payload: Partial<DetailsState> }
  | { type: 'ADD_DIVER'; payload: DiverEntry }
  | { type: 'REMOVE_DIVER'; payload: number }
  | { type: 'UPDATE_DIVER'; payload: { index: number; data: Partial<DiverEntry> } }
  | { type: 'SET_RESOURCE'; payload: Partial<ResourcesState> }
  | { type: 'SET_SESSIONS'; payload: SessionEntry[] }
  | { type: 'RESET'; payload?: Partial<WizardState> }

// ── Reducer ───────────────────────────────────────────────────────────────────

export function makeInitialState(bookingId: string | null = null): WizardState {
  const today = new Date().toISOString().split('T')[0]
  return {
    step: 'details',
    bookingId,
    details: {
      activityType: [],
      startDate: today,
      endDate: today,
      portalContact: true,
      portalMedical: true,
      portalWaiver: true,
    },
    divers: [],
    resources: {},
    sessions: [],
  }
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload }

    case 'SET_BOOKING_ID':
      return { ...state, bookingId: action.payload }

    case 'UPDATE_FIELD':
      return { ...state, details: { ...state.details, ...action.payload } }

    case 'ADD_DIVER':
      return { ...state, divers: [...state.divers, action.payload] }

    case 'REMOVE_DIVER':
      return { ...state, divers: state.divers.filter((_, i) => i !== action.payload) }

    case 'UPDATE_DIVER': {
      const { index, data } = action.payload
      return {
        ...state,
        divers: state.divers.map((d, i) => (i === index ? { ...d, ...data } : d)),
      }
    }

    case 'SET_RESOURCE':
      return { ...state, resources: { ...state.resources, ...action.payload } }

    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload }

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

export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step)
}
