// ── Session Builder ───────────────────────────────────────────────────────────
// Generates per-day session drafts from course catalog rules, diver assignments,
// and resource selections. Pure utility — no Convex, no React.

import type { DetailsState, DiverEntry, ResourcesState, SessionEntry } from './wizard-state'
import { getCourseByCode, type CourseCode } from '@/lib/constants/course-catalog'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Venue = 'Boat' | 'Shore'

export interface DiveSlotDisplay {
  courseCode: CourseCode
  diveNumber: number
  isConfined: boolean
  diverIndex: number
  diverAbbrev: string
}

export interface ScheduledSession {
  // Fields that map to SessionEntry (wizard state)
  inventoryUnitId: string // placeholder — resolved by submitToDraft mutation
  date: string
  startTime: string
  endTime: string
  timezone: string
  unitsRequested: number
  deliveryLocation: 'BoatPier' | 'Pool' | 'Beach'
  // Display-only metadata (not persisted to wizard state)
  resourceType: 'boat' | 'pool'
  diveSlots: DiveSlotDisplay[]
  isConfinedDay: boolean
}

// ── Delivery Location ─────────────────────────────────────────────────────────

// Pure function — auto-sets delivery location based on session type and venue.
// Confined days are always Pool regardless of venue.
export function getDeliveryLocation(
  isConfinedDay: boolean,
  venue: Venue = 'Boat',
): 'BoatPier' | 'Pool' | 'Beach' {
  if (isConfinedDay) return 'Pool'
  return venue === 'Shore' ? 'Beach' : 'BoatPier'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getDatesInRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return []

  const dates: string[] = []
  const current = new Date(start)
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates
}

interface SequenceEntry {
  dayIndex: number
  diveNumber: number
  isConfined: boolean
}

// Builds a dive sequence for a single course across the given number of booking days.
// Confined courses put dives 1–2 on day 0 (pool), remaining days are open water.
function buildCourseSequence(code: CourseCode, numDays: number): SequenceEntry[] {
  const course = getCourseByCode(code)
  if (!course) return []

  const effectiveDays = Math.max(numDays, course.minDays)
  // Single-activity courses (no numbered dives) get 1 dive per day; others get 2.
  const divesPerDay = code === 'DSD' || code === 'FD' || code === 'REFRESH' ? 1 : 2

  const entries: SequenceEntry[] = []
  let counter = 1
  for (let day = 0; day < effectiveDays; day++) {
    const isConfined = course.requiresConfined && day === 0
    for (let i = 0; i < divesPerDay; i++) {
      entries.push({ dayIndex: day, diveNumber: counter++, isConfined })
    }
  }
  return entries
}

function diverCountForConfined(divers: DiverEntry[]): number {
  return divers.filter(d => d.activityType.some(c => getCourseByCode(c)?.requiresConfined)).length
}

// ── Main Generator ────────────────────────────────────────────────────────────

export function buildScheduledSessions(
  details: DetailsState,
  divers: DiverEntry[],
  _resources: ResourcesState,
  timezone = 'Asia/Bangkok',
): ScheduledSession[] {
  const dates = getDatesInRange(details.startDate, details.endDate)
  if (dates.length === 0) return []

  const anyConfinedCourse = divers.some(d =>
    d.activityType.some(c => getCourseByCode(c)?.requiresConfined),
  )

  const sessions: ScheduledSession[] = []

  for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
    const date = dates[dayIndex]
    const isConfinedDay = anyConfinedCourse && dayIndex === 0

    // Build dive slots for this day across all divers and their courses
    const diveSlots: DiveSlotDisplay[] = []
    for (let di = 0; di < divers.length; di++) {
      const diver = divers[di]
      for (const courseCode of diver.activityType) {
        const seq = buildCourseSequence(courseCode, dates.length)
        for (const entry of seq) {
          if (entry.dayIndex === dayIndex) {
            diveSlots.push({
              courseCode,
              diveNumber: entry.diveNumber,
              isConfined: entry.isConfined,
              diverIndex: di,
              diverAbbrev: diver.abbrev,
            })
          }
        }
      }
    }

    if (isConfinedDay) {
      sessions.push({
        inventoryUnitId: '',
        date,
        startTime: '09:00',
        endTime: '14:00',
        timezone,
        unitsRequested: Math.max(diverCountForConfined(divers), 1),
        deliveryLocation: getDeliveryLocation(true),
        resourceType: 'pool',
        diveSlots,
        isConfinedDay: true,
      })
    } else {
      sessions.push({
        inventoryUnitId: '',
        date,
        startTime: '08:00',
        endTime: '12:00',
        timezone,
        unitsRequested: Math.max(divers.length, 1),
        deliveryLocation: getDeliveryLocation(false, 'Boat'),
        resourceType: 'boat',
        diveSlots,
        isConfinedDay: false,
      })
    }
  }

  return sessions
}

// ── Conversion ────────────────────────────────────────────────────────────────

// Strips display-only fields, producing the lean entries stored in wizard state.
export function toSessionEntries(sessions: ScheduledSession[]): SessionEntry[] {
  return sessions.map(s => ({
    inventoryUnitId: s.inventoryUnitId,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    timezone: s.timezone,
    unitsRequested: s.unitsRequested,
    deliveryLocation: s.deliveryLocation,
  }))
}
