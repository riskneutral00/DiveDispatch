import { ConvexError, v } from 'convex/values'
import { type CourseCode, courseCodeValidator } from '../shared/courseCodes'
import { ErrorCode } from '../lib/errorCodes'
import { MEDICAL_TTL_MS } from '../lib/timeConstants'
import { type VacatedReason, type BookingStatus, type ReservationStatus, BOOKING_STATUS, RESERVATION_STATUS } from '../shared/statuses'
export { type CourseCode, courseCodeValidator } from '../shared/courseCodes'
export { type VacatedReason } from '../shared/statuses'

export type BookingRoleType = 'Instructor' | 'DiveMaster'

export type SessionInput = {
  inventoryUnitId: string
  date: string
  startTime: string
  endTime: string
  timezone: string
  unitsRequested: number
  deliveryLocation?: 'BoatPier' | 'Pool' | 'Beach'
  diveSlots?: Array<{
    courseCode: CourseCode
    diveNumber: number
    isConfined: boolean
    diverIndex: number
  }>
}

export type BookingResourceInput = {
  resourceType: string
  roleType?: BookingRoleType
  resourceId?: string
  externalName?: string
}

export type BookingData = {
  activityType: CourseCode[]
  startDate: string
  endDate: string
  portalContact: boolean
  portalMedical: boolean
  portalWaiver: boolean
  agentId?: string
  agentIsReferral?: boolean
  resources?: BookingResourceInput[]
  divers: Array<{
    name: string
    abbrev: string
    flag: { code: string; label: string }
    startDate: string
    endDate: string
    agency?: string
    activityType: CourseCode[]
    contactType?: 'email' | 'whatsapp' | 'line'
    contactValue?: string
  }>
}

export type SubmitToDraftArgs = {
  bookingId: string
  sessions: SessionInput[]
  bookingData?: BookingData
}

export const sessionValidator = v.object({
  inventoryUnitId: v.id('inventoryUnits'),
  date: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  timezone: v.string(),
  unitsRequested: v.number(),
  deliveryLocation: v.optional(
    v.union(v.literal('BoatPier'), v.literal('Pool'), v.literal('Beach')),
  ),
  diveSlots: v.optional(
    v.array(
      v.object({
        courseCode: courseCodeValidator,
        diveNumber: v.number(),
        isConfined: v.boolean(),
        diverIndex: v.number(),
      }),
    ),
  ),
})

export const bookingResourceInputValidator = v.object({
  resourceType: v.string(),
  roleType: v.optional(v.union(v.literal('Instructor'), v.literal('DiveMaster'))),
  resourceId: v.optional(v.string()),
  externalName: v.optional(v.string()),
})

export const bookingDataValidator = v.object({
  activityType: v.array(courseCodeValidator),
  startDate: v.string(),
  endDate: v.string(),
  portalContact: v.boolean(),
  portalMedical: v.boolean(),
  portalWaiver: v.boolean(),
  agentId: v.optional(v.string()),
  agentIsReferral: v.optional(v.boolean()),
  resources: v.optional(v.array(bookingResourceInputValidator)),
  divers: v.array(
    v.object({
      name: v.string(),
      abbrev: v.string(),
      flag: v.object({ code: v.string(), label: v.string() }),
      startDate: v.string(),
      endDate: v.string(),
      agency: v.optional(v.string()),
      activityType: v.array(courseCodeValidator),
      contactType: v.optional(v.union(v.literal('email'), v.literal('whatsapp'), v.literal('line'))),
      contactValue: v.optional(v.string()),
    }),
  ),
})

export function canBookingTransition(
  currentStatus: BookingStatus,
  action: 'confirm' | 'edit' | 'cancel' | 'complete' | 'decline_cascade' | 'expire' | 'archive',
): boolean {
  if (currentStatus === BOOKING_STATUS.Cancelled || currentStatus === BOOKING_STATUS.Archived) {
    return false
  }

  switch (action) {
    case 'confirm':
      return currentStatus === BOOKING_STATUS.Draft
    case 'edit':
      return currentStatus === BOOKING_STATUS.Upcoming
    case 'cancel':
      return true // non-terminal guard above already filtered
    case 'complete':
      return currentStatus === BOOKING_STATUS.Upcoming
    case 'decline_cascade':
      return currentStatus === BOOKING_STATUS.Upcoming
    case 'expire':
      return currentStatus === BOOKING_STATUS.Draft
    case 'archive':
      return currentStatus === BOOKING_STATUS.Completed
    default:
      return false
  }
}

export function canReservationTransition(
  currentStatus: ReservationStatus,
  action: 'accept' | 'vacate' | 'mark_noshow' | 'revert_noshow',
): boolean {
  switch (action) {
    case 'accept':
      return currentStatus === RESERVATION_STATUS.PendingAcceptance
    case 'vacate':
      return currentStatus === RESERVATION_STATUS.PendingAcceptance || currentStatus === RESERVATION_STATUS.Confirmed
    case 'mark_noshow':
      return currentStatus === RESERVATION_STATUS.Confirmed
    case 'revert_noshow':
      return currentStatus === RESERVATION_STATUS.NoShow
    default:
      return false
  }
}

export function isActiveReservation(reservation: { status: string }): boolean {
  return (
    reservation.status === RESERVATION_STATUS.PendingAcceptance ||
    reservation.status === RESERVATION_STATUS.Confirmed
  )
}

export function isFullDayResource(inventoryUnit: {
  resourceType: string
  boatType?: string
}): boolean {
  return (
    inventoryUnit.resourceType === 'Boat' &&
    (inventoryUnit.boatType === 'day_boat' || inventoryUnit.boatType === 'liveaboard')
  )
}

export { isBookingExpired } from '../shared/bookingExpiry'

export function todayISO(timezone = 'Asia/Bangkok'): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(formatter.formatToParts(Date.now()).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function assertNoPastDates(
  sessions: { date: string; timezone?: string }[],
  timezone = 'Asia/Bangkok',
): void {
  const today = todayISO(timezone)

  for (const session of sessions) {
    if (session.date < today) {
      throw new ConvexError({ code: ErrorCode.PAST_DATE, date: session.date })
    }
  }
}

export function computeMedicalDeadline(
  creationTime: number,
  earliestDate: string,
  timezone: string,
): number {
  const ttlDeadline = creationTime + MEDICAL_TTL_MS

  const [year, month, day] = earliestDate.split('-').map(Number)
  const refUTC = Date.UTC(year, month - 1, day - 1, 12, 0, 0)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  })
  const hourParts = formatter.formatToParts(refUTC)
  const hourStr = hourParts.find((p) => p.type === 'hour')?.value ?? '12'
  const localHour = parseInt(hourStr === '24' ? '0' : hourStr, 10)
  const utcOffsetHours = localHour - 12

  const deadline8pm = Date.UTC(year, month - 1, day - 1, 20 - utcOffsetHours, 0, 0)

  return Math.min(ttlDeadline, deadline8pm)
}

function currentLocalDateTime(timezone: string): { currentDate: string; currentTime: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = Object.fromEntries(formatter.formatToParts(Date.now()).map((p) => [p.type, p.value]))
  const currentDate = `${parts.year}-${parts.month}-${parts.day}`
  const hour = parts.hour === '24' ? '00' : parts.hour
  const currentTime = `${hour}:${parts.minute}`
  return { currentDate, currentTime }
}

export function isSessionStarted(date: string, startTime: string, timezone: string): boolean {
  const { currentDate, currentTime } = currentLocalDateTime(timezone)
  if (currentDate > date) return true
  if (currentDate === date && currentTime >= startTime) return true
  return false
}

export function isSessionEnded(date: string, endTime: string, timezone: string): boolean {
  const { currentDate, currentTime } = currentLocalDateTime(timezone)
  if (currentDate > date) return true
  if (currentDate === date && currentTime >= endTime) return true
  return false
}
