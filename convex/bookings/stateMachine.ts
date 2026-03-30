/**
 * State-machine guards, type definitions, validators, and pure helper functions
 * for booking mutations. Extracted from _shared.ts (L8-24).
 */

import { ConvexError, v } from 'convex/values'
import { type CourseCode, courseCodeValidator } from '../shared/courseCodes'
import { ErrorCode } from '../lib/errorCodes'
import { MEDICAL_TTL_MS } from '../lib/timeConstants'
import { type VacatedReason, type BookingStatus, type ReservationStatus, BOOKING_STATUS, RESERVATION_STATUS } from '../shared/statuses'
export { type CourseCode, courseCodeValidator } from '../shared/courseCodes'
export { type VacatedReason } from '../shared/statuses'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  /** Original stakeholder role — used to distinguish DiveMaster (capacity +2) from Instructor (capacity +4). */
  roleType?: string
  resourceSlug?: string
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
  }>
}

export type SubmitToDraftArgs = {
  bookingId: string
  sessions: SessionInput[]
  bookingData?: BookingData
}

// ─── Validators ───────────────────────────────────────────────────────────────

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
  /** Original stakeholder role — used to distinguish DiveMaster (capacity +2) from Instructor (capacity +4). */
  roleType: v.optional(v.string()),
  resourceSlug: v.optional(v.string()),
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
    }),
  ),
})

// ─── State Machines ───────────────────────────────────────────────────────────

/**
 * Booking status transition guard. Returns true if the transition is valid.
 *
 * confirm: Draft only (auto-advance to Upcoming)
 * edit:    Upcoming | Completed (operator edit resets to Draft)
 * cancel:  Any non-Cancelled status
 * complete: Upcoming only (auto-complete cron)
 */
export function canBookingTransition(
  currentStatus: BookingStatus,
  action: 'confirm' | 'edit' | 'cancel' | 'complete',
): boolean {
  switch (action) {
    case 'confirm':
      return currentStatus === BOOKING_STATUS.Draft
    case 'edit':
      return currentStatus === BOOKING_STATUS.Upcoming || currentStatus === BOOKING_STATUS.Completed
    case 'cancel':
      return currentStatus !== BOOKING_STATUS.Cancelled
    case 'complete':
      return currentStatus === BOOKING_STATUS.Upcoming
    default:
      return false
  }
}

/**
 * Reservation status transition guard. Returns true if the transition is valid.
 *
 * accept: PendingAcceptance only
 * vacate: PendingAcceptance | Confirmed
 */
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

/**
 * Returns true if the reservation is in an active state (PendingAcceptance or Confirmed).
 * Replaces inline `r.status === 'PendingAcceptance' || r.status === 'Confirmed'` filters.
 */
export function isActiveReservation(reservation: { status: string }): boolean {
  return (
    reservation.status === RESERVATION_STATUS.PendingAcceptance ||
    reservation.status === RESERVATION_STATUS.Confirmed
  )
}

// ─── Overlap granularity ──────────────────────────────────────────────────────

/**
 * Returns true if the inventory unit requires full-day overlap checking.
 *
 * Day boats and liveaboards go to one destination per day — a single reservation
 * blocks all other bookings on that calendar date regardless of time window.
 * All other resource types (speedboat, longtail, catamaran, rib, instructor,
 * equipment, etc.) use time-window granularity.
 *
 * Safe default: missing boatType → time-window (never over-blocks).
 */
export function isFullDayResource(inventoryUnit: {
  resourceType: string
  boatType?: string
}): boolean {
  return (
    inventoryUnit.resourceType === 'Boat' &&
    (inventoryUnit.boatType === 'day_boat' || inventoryUnit.boatType === 'liveaboard')
  )
}

// ─── Expiry helper ────────────────────────────────────────────────────────────

// Canonical implementation lives in convex/shared/bookingExpiry.ts
export { isBookingExpired } from '../shared/bookingExpiry'

// ─── Past-date guard ─────────────────────────────────────────────────────

/**
 * Returns today's date as an ISO string (YYYY-MM-DD), timezone-aware.
 * Uses Intl.DateTimeFormat so the server computes "today" in the operator's
 * local timezone rather than UTC.
 *
 * Defaults to Asia/Bangkok for single-market operation. For multi-market
 * expansion, callers should pass the session's timezone from the
 * bookingSessions.timezone field (schema line 194) instead of relying
 * on this default.
 */
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

/**
 * Throws ConvexError if any session date is before today (server-side, timezone-aware).
 */
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

// ─── Time helpers ─────────────────────────────────────────────────────────────

/**
 * Computes the medical-block hold deadline per CLAUDE.md rules:
 *   Total 36h from booking creation, hard ceiling 8pm night before activity date.
 *   Returns whichever comes first as a Unix timestamp.
 */
export function computeMedicalDeadline(
  creationTime: number,
  earliestDate: string,
  timezone: string,
): number {
  const ttlDeadline = creationTime + MEDICAL_TTL_MS

  // 8pm night before the activity date in the session timezone.
  // Use Intl to derive the UTC offset for the timezone at ~that date.
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

  // 20:00 local = (20 - offset) UTC. Date.UTC handles hour overflow correctly.
  const deadline8pm = Date.UTC(year, month - 1, day - 1, 20 - utcOffsetHours, 0, 0)

  return Math.min(ttlDeadline, deadline8pm)
}

/**
 * Check whether a session's end time has passed in the session's local timezone.
 * Uses Intl.DateTimeFormat to compare current time against session end date/time.
 */
export function isSessionEnded(date: string, endTime: string, timezone: string): boolean {
  const now = Date.now()

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]))
  const currentDate = `${parts.year}-${parts.month}-${parts.day}`
  // hour12: false can emit '24' for midnight in some runtimes
  const hour = parts.hour === '24' ? '00' : parts.hour
  const currentTime = `${hour}:${parts.minute}`

  if (currentDate > date) return true
  if (currentDate === date && currentTime >= endTime) return true
  return false
}
