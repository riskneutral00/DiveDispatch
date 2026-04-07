import { getCourseByCode, type CourseCode } from '@/lib/constants/course-catalog'
import { getDatesInRange } from '@/lib/utils/date'
import type { DayConfig } from '@/lib/booking/wizard-state'

export type Venue = 'Boat' | 'Shore'

export interface DiveSlotDisplay {
  courseCode: CourseCode
  diveNumber: number
  isConfined: boolean
  diverIndex: number
  diverAbbrev: string
}

export interface ScheduledSession {
  inventoryUnitId: string // placeholder — resolved by submitToDraft mutation
  date: string
  startTime: string
  endTime: string
  timezone: string
  unitsRequested: number
  deliveryLocation: 'BoatPier' | 'Pool' | 'Beach'
  resourceType: 'boat' | 'pool'
  diveSlots: DiveSlotDisplay[]
  isConfinedDay: boolean
}

export function getDeliveryLocation(
  isConfinedDay: boolean,
  venue: Venue = 'Boat',
): 'BoatPier' | 'Pool' | 'Beach' {
  if (isConfinedDay) return 'Pool'
  return venue === 'Shore' ? 'Beach' : 'BoatPier'
}

interface SequenceEntry {
  dayIndex: number
  diveNumber: number
  isConfined: boolean
}

function buildCourseSequence(code: CourseCode, numDays: number): SequenceEntry[] {
  const course = getCourseByCode(code)
  if (!course) return []

  const effectiveDays = Math.max(numDays, course.minDays)
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

export function buildSessionsFromDays(
  days: DayConfig[],
  customerCount: number,
): ScheduledSession[] {
  return days.map((day) => {
    const isConfinedDay = day.venueType === 'pool'
    const venue: Venue = day.venueType === 'shore' ? 'Shore' : 'Boat'

    const diveSlots: DiveSlotDisplay[] = day.dives.map((slot, idx) => ({
      courseCode: slot.courseCode as CourseCode,
      diveNumber: slot.diveNumber,
      isConfined: slot.isConfined,
      diverIndex: idx,
      diverAbbrev: String(idx + 1),
    }))

    return {
      inventoryUnitId: day.inventoryUnitId ?? '',
      date: day.date,
      startTime: day.startTime,
      endTime: day.endTime,
      timezone: day.timezone,
      unitsRequested: Math.max(customerCount, 1),
      deliveryLocation: getDeliveryLocation(isConfinedDay, venue),
      resourceType: isConfinedDay ? 'pool' : 'boat',
      diveSlots,
      isConfinedDay,
    }
  })
}

export function buildDefaultDays(
  startDate: string,
  endDate: string,
  courseCodes: CourseCode[],
  timezone = 'Asia/Bangkok',
): DayConfig[] {
  const dates = getDatesInRange(startDate, endDate)
  if (dates.length === 0) return []

  const anyConfined = courseCodes.some((c) => getCourseByCode(c)?.requiresConfined)

  return dates.map((date, dayIndex) => {
    const isConfinedDay = anyConfined && dayIndex === 0

    const dives = courseCodes.flatMap((code) => {
      const seq = buildCourseSequence(code, dates.length)
      return seq
        .filter((e) => e.dayIndex === dayIndex)
        .map((e) => ({
          courseCode: code,
          diveNumber: e.diveNumber,
          isConfined: e.isConfined,
        }))
    })

    return {
      date,
      venueType: isConfinedDay ? ('pool' as const) : ('boat' as const),
      dives,
      divesPerDay: 2,
      startTime: isConfinedDay ? '09:00' : '08:00',
      endTime: isConfinedDay ? '14:00' : '12:00',
      timezone,
    }
  })
}
