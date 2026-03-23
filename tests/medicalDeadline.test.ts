/**
 * H5: Medical Deadline Calculation
 *
 * Tests computeMedicalDeadline from convex/bookings/_shared.ts:
 *   - 36h TTL from booking creation
 *   - 8pm ceiling (night before activity, in session timezone)
 *   - Returns whichever comes first
 *
 * Edge cases: same-day activity, negative/positive UTC offsets, year boundary, DST.
 */

import { describe, it, expect } from 'vitest'
import { computeMedicalDeadline } from '../convex/bookings/_shared'

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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('computeMedicalDeadline', () => {
  it('H5-1: 36h TTL wins when activity is far out', () => {
    // Activity 10 days from now. 36h deadline is much earlier than 8pm day-before.
    // Creation: 2026-04-10 10:00 UTC
    const creationTime = utc('2026-04-10T10:00:00')
    const earliestDate = '2026-04-20' // 10 days out
    const timezone = 'Asia/Bangkok' // UTC+7

    const deadline = computeMedicalDeadline(creationTime, earliestDate, timezone)
    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 36h from creation = 2026-04-11T22:00 UTC
    // 8pm local Apr 19 in Bangkok = 8pm Bangkok = 13:00 UTC Apr 19
    // 36h (Apr 11) is much earlier than 8pm day-before (Apr 19) → TTL wins
    expect(deadline).toBe(ttlDeadline)
  })

  it('H5-2: 8pm ceiling wins when activity is tomorrow', () => {
    // Activity is tomorrow. 36h deadline would be past 8pm tonight.
    // Creation: 2026-04-19 12:00 UTC (= 7pm Bangkok)
    const creationTime = utc('2026-04-19T12:00:00')
    const earliestDate = '2026-04-20'
    const timezone = 'Asia/Bangkok' // UTC+7

    const deadline = computeMedicalDeadline(creationTime, earliestDate, timezone)

    // 36h from creation = 2026-04-21T00:00 UTC
    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 8pm Bangkok on Apr 19 = 13:00 UTC Apr 19
    // 13:00 UTC < 00:00 UTC Apr 21 → 8pm ceiling is earlier → wins
    expect(deadline).toBeLessThan(ttlDeadline)

    // The 8pm ceiling should be 8pm Bangkok time = 13:00 UTC on Apr 19
    const ceiling8pm = utc('2026-04-19T13:00:00')
    expect(deadline).toBe(ceiling8pm)
  })

  it('H5-3: same-day activity — 8pm previous day already past', () => {
    // Activity is today. 8pm yesterday is already in the past.
    // Creation: 2026-04-20 02:00 UTC (= 9am Bangkok)
    const creationTime = utc('2026-04-20T02:00:00')
    const earliestDate = '2026-04-20' // same day
    const timezone = 'Asia/Bangkok' // UTC+7

    const deadline = computeMedicalDeadline(creationTime, earliestDate, timezone)

    // 36h from creation = 2026-04-21T14:00 UTC
    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 8pm Bangkok on Apr 19 = 13:00 UTC Apr 19 (already past at creation time)
    const ceiling8pm = utc('2026-04-19T13:00:00')

    // Return the smaller of the two — which is the 8pm ceiling (already past)
    expect(deadline).toBe(Math.min(ttlDeadline, ceiling8pm))
    expect(deadline).toBe(ceiling8pm)
  })

  it('H5-4: negative UTC offset — America/New_York (UTC-5): 8pm local = 01:00 UTC next day', () => {
    // New York is UTC-5 (standard time; April is EDT = UTC-4, but let's test the function)
    // Activity: 2026-12-15 (standard time, UTC-5)
    const creationTime = utc('2026-12-14T23:00:00')
    const earliestDate = '2026-12-15'
    const timezone = 'America/New_York' // UTC-5 in December

    const deadline = computeMedicalDeadline(creationTime, earliestDate, timezone)

    // 36h from creation = 2026-12-16T11:00 UTC
    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 8pm New York (EST, UTC-5) on Dec 14 = 01:00 UTC Dec 15
    const ceiling8pm = utc('2026-12-15T01:00:00')

    // ceiling8pm (01:00 UTC Dec 15) < ttlDeadline (11:00 UTC Dec 16) → ceiling wins
    expect(deadline).toBe(ceiling8pm)
  })

  it('H5-5: positive UTC offset — Asia/Bangkok (UTC+7): 8pm local = 13:00 UTC same day', () => {
    // Bangkok is UTC+7 year-round (no DST)
    const creationTime = utc('2026-06-14T10:00:00')
    const earliestDate = '2026-06-15'
    const timezone = 'Asia/Bangkok' // UTC+7

    const deadline = computeMedicalDeadline(creationTime, earliestDate, timezone)

    // 36h from creation = 2026-06-15T22:00 UTC
    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 8pm Bangkok on Jun 14 = 13:00 UTC Jun 14
    const ceiling8pm = utc('2026-06-14T13:00:00')

    // ceiling8pm (13:00 UTC Jun 14) < ttlDeadline (22:00 UTC Jun 15) → ceiling wins
    expect(deadline).toBe(ceiling8pm)
  })

  it('H5-6: year boundary — activity Jan 1, 2027, day before = Dec 31, 2026', () => {
    // Creation far enough back that 36h TTL is earlier
    const creationTime = utc('2026-12-29T10:00:00')
    const earliestDate = '2027-01-01'
    const timezone = 'Asia/Bangkok' // UTC+7

    const deadline = computeMedicalDeadline(creationTime, earliestDate, timezone)

    // 36h from creation = 2026-12-30T22:00 UTC
    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 8pm Bangkok on Dec 31 = 13:00 UTC Dec 31
    // ttlDeadline (Dec 30 22:00) < ceiling (Dec 31 13:00) → TTL wins
    expect(deadline).toBe(ttlDeadline)
  })

  it('H5-7: DST transition — spring-forward day uses correct UTC offset', () => {
    // US Spring forward 2027: March 14 (second Sunday of March)
    // Before DST: EST = UTC-5, After DST: EDT = UTC-4
    // Activity: March 15, 2027 (after spring forward)
    // Day before: March 14 (DST transition day)
    const creationTime = utc('2027-03-14T05:00:00')
    const earliestDate = '2027-03-15'
    const timezone = 'America/New_York'

    const deadline = computeMedicalDeadline(creationTime, earliestDate, timezone)

    // 36h from creation = 2027-03-15T17:00 UTC
    const ttlDeadline = creationTime + MEDICAL_TTL_MS

    // 8pm New York on March 14 — during DST transition
    // After spring forward, EDT = UTC-4, so 8pm EDT = 00:00 UTC March 15
    const ceiling8pmEDT = utc('2027-03-15T00:00:00')

    // ceiling (00:00 UTC Mar 15) < ttlDeadline (17:00 UTC Mar 15) → ceiling wins
    expect(deadline).toBe(ceiling8pmEDT)
  })
})
