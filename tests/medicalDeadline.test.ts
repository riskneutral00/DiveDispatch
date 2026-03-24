/**
 * H5: Medical Deadline Calculation
 *
 * Tests computeMedicalDeadline from convex/bookings/_shared.ts:
 *   - 36h TTL from booking creation
 *   - 8pm ceiling (night before activity, in session timezone)
 *   - Returns whichever comes first
 *
 * Edge cases: same-day activity, negative/positive UTC offsets, year boundary, DST.
 *
 * NOTE: H5-4, H5-6, H5-7 use pinned dates because they test timezone edge cases
 * (EST winter offset, year boundary, DST transition) that require specific calendar
 * dates. Bangkok tests (no DST) use relative dates via testDate().
 */

import { describe, it, expect } from 'vitest'
import { computeMedicalDeadline } from '../convex/bookings/_shared'
import { testDate } from './helpers/dates'
import { addDays } from '../src/lib/utils/date'

// ─── Constants ──────────────────────────────────────────────────────────────

const HOUR = 60 * 60 * 1000
const MEDICAL_TTL_MS = 36 * HOUR

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a timestamp from a date/time string in UTC.
 * e.g. utc('2026-04-20T10:00:00') → Unix timestamp
 */
function utc(dateTimeStr: string): number {
  return new Date(dateTimeStr + 'Z').getTime()
}

/** Compose a UTC timestamp from an ISO date and a UTC time. */
function utcAt(isoDate: string, time: string): number {
  return utc(`${isoDate}T${time}`)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('computeMedicalDeadline', () => {
  // Activity date for Bangkok tests — far enough in the future to stay valid
  const activityDate = testDate(30)
  const dayBefore = addDays(activityDate, -1)

  it('H5-1: 36h TTL wins when activity is far out', () => {
    // Activity 10 days from creation. 36h deadline is much earlier than 8pm day-before.
    const creationDate = addDays(activityDate, -10)
    const creationTime = utcAt(creationDate, '10:00:00')
    const timezone = 'Asia/Bangkok' // UTC+7

    const deadline = computeMedicalDeadline(creationTime, activityDate, timezone)
    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 36h from creation is much earlier than 8pm day-before → TTL wins
    expect(deadline).toBe(ttlDeadline)
  })

  it('H5-2: 8pm ceiling wins when activity is tomorrow', () => {
    // Activity is tomorrow. 36h deadline would be past 8pm tonight.
    // Creation: day before activity at 12:00 UTC (= 7pm Bangkok)
    const creationTime = utcAt(dayBefore, '12:00:00')
    const timezone = 'Asia/Bangkok' // UTC+7

    const deadline = computeMedicalDeadline(creationTime, activityDate, timezone)

    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 8pm Bangkok on dayBefore = 13:00 UTC on dayBefore
    // 13:00 UTC dayBefore < ttlDeadline → 8pm ceiling wins
    expect(deadline).toBeLessThan(ttlDeadline)

    const ceiling8pm = utcAt(dayBefore, '13:00:00')
    expect(deadline).toBe(ceiling8pm)
  })

  it('H5-3: same-day activity — 8pm previous day already past', () => {
    // Activity is "today" (same date as creation). 8pm yesterday is already past.
    // Creation: activity date at 02:00 UTC (= 9am Bangkok)
    const creationTime = utcAt(activityDate, '02:00:00')
    const timezone = 'Asia/Bangkok' // UTC+7

    const deadline = computeMedicalDeadline(creationTime, activityDate, timezone)

    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 8pm Bangkok on dayBefore = 13:00 UTC dayBefore (already past at creation)
    const ceiling8pm = utcAt(dayBefore, '13:00:00')

    expect(deadline).toBe(Math.min(ttlDeadline, ceiling8pm))
    expect(deadline).toBe(ceiling8pm)
  })

  // ── Pinned-date tests: timezone edge cases requiring specific calendar dates ──

  it('H5-4: negative UTC offset — America/New_York (UTC-5): 8pm local = 01:00 UTC next day', () => {
    // Pinned: December date required for EST (UTC-5, no DST)
    const creationTime = utc('2026-12-14T23:00:00')
    const earliestDate = '2026-12-15'
    const timezone = 'America/New_York' // UTC-5 in December

    const deadline = computeMedicalDeadline(creationTime, earliestDate, timezone)

    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 8pm New York (EST, UTC-5) on Dec 14 = 01:00 UTC Dec 15
    const ceiling8pm = utc('2026-12-15T01:00:00')

    // ceiling8pm < ttlDeadline → ceiling wins
    expect(deadline).toBe(ceiling8pm)
  })

  it('H5-5: positive UTC offset — Asia/Bangkok (UTC+7): 8pm local = 13:00 UTC same day', () => {
    // Bangkok is UTC+7 year-round (no DST)
    const earlyActivity = testDate(25)
    const earlyDayBefore = addDays(earlyActivity, -1)
    const creationTime = utcAt(earlyDayBefore, '10:00:00')
    const timezone = 'Asia/Bangkok' // UTC+7

    const deadline = computeMedicalDeadline(creationTime, earlyActivity, timezone)

    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 8pm Bangkok on dayBefore = 13:00 UTC on dayBefore
    const ceiling8pm = utcAt(earlyDayBefore, '13:00:00')

    // ceiling8pm < ttlDeadline → ceiling wins
    expect(deadline).toBe(ceiling8pm)
  })

  it('H5-6: year boundary — activity Jan 1 next year, day before = Dec 31', () => {
    // Pinned: must cross year boundary Dec 31 → Jan 1
    const creationTime = utc('2026-12-29T10:00:00')
    const earliestDate = '2027-01-01'
    const timezone = 'Asia/Bangkok' // UTC+7

    const deadline = computeMedicalDeadline(creationTime, earliestDate, timezone)

    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 8pm Bangkok on Dec 31 = 13:00 UTC Dec 31
    // ttlDeadline (Dec 30 22:00) < ceiling (Dec 31 13:00) → TTL wins
    expect(deadline).toBe(ttlDeadline)
  })

  it('H5-7: DST transition — spring-forward day uses correct UTC offset', () => {
    // Pinned: US Spring forward 2027 = March 14 (second Sunday of March)
    // Before DST: EST = UTC-5, After DST: EDT = UTC-4
    const creationTime = utc('2027-03-14T05:00:00')
    const earliestDate = '2027-03-15'
    const timezone = 'America/New_York'

    const deadline = computeMedicalDeadline(creationTime, earliestDate, timezone)

    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 8pm New York on March 14 — DST transition day
    // After spring forward, EDT = UTC-4, so 8pm EDT = 00:00 UTC March 15
    const ceiling8pmEDT = utc('2027-03-15T00:00:00')

    // ceiling < ttlDeadline → ceiling wins
    expect(deadline).toBe(ceiling8pmEDT)
  })
})
