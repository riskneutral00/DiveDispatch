import { describe, it, expect } from 'vitest'
import { deriveStatus } from '../use-calendar-range'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function booking(
  status: string,
  startDate: string,
  endDate: string,
  reservationStatus?: string,
) {
  return { status, startDate, endDate, reservationStatus }
}

// ─── Active derivation (day-level boundaries) ────────────────────────────────

describe('deriveStatus — Active boundaries', () => {
  // O+A course: starts 2026-03-16, ends 2026-03-19
  const start = '2026-03-16'
  const end = '2026-03-19'

  it('day before first session → Upcoming', () => {
    expect(deriveStatus(booking('Upcoming', start, end), '2026-03-15')).toBe('Upcoming')
  })

  it('first session date → Active', () => {
    expect(deriveStatus(booking('Upcoming', start, end), '2026-03-16')).toBe('Active')
  })

  it('mid-course date → Active', () => {
    expect(deriveStatus(booking('Upcoming', start, end), '2026-03-17')).toBe('Active')
  })

  it('last session date → Active', () => {
    expect(deriveStatus(booking('Upcoming', start, end), '2026-03-19')).toBe('Active')
  })

  it('day after last session → Completed', () => {
    expect(deriveStatus(booking('Upcoming', start, end), '2026-03-20')).toBe('Completed')
  })
})

// ─── Single-day booking ──────────────────────────────────────────────────────

describe('deriveStatus — single-day booking', () => {
  const date = '2026-04-01'

  it('day-of → Active', () => {
    expect(deriveStatus(booking('Upcoming', date, date), '2026-04-01')).toBe('Active')
  })

  it('day after → Completed', () => {
    expect(deriveStatus(booking('Upcoming', date, date), '2026-04-02')).toBe('Completed')
  })

  it('day before → Upcoming', () => {
    expect(deriveStatus(booking('Upcoming', date, date), '2026-03-31')).toBe('Upcoming')
  })
})

// ─── Cancelled bookings ──────────────────────────────────────────────────────

describe('deriveStatus — Cancelled', () => {
  it('Cancelled on any date → null (hidden)', () => {
    expect(deriveStatus(booking('Cancelled', '2026-03-16', '2026-03-19'), '2026-03-17')).toBeNull()
  })

  it('Cancelled before start → null', () => {
    expect(deriveStatus(booking('Cancelled', '2026-03-16', '2026-03-19'), '2026-03-10')).toBeNull()
  })
})

// ─── Draft bookings ──────────────────────────────────────────────────────────

describe('deriveStatus — Draft', () => {
  it('Draft with endDate in the past → null (hidden)', () => {
    expect(deriveStatus(booking('Draft', '2026-03-01', '2026-03-05'), '2026-03-10')).toBeNull()
  })

  it('Draft with endDate in the future → Draft', () => {
    // Start date far enough from "today" to avoid isUrgentDraft (12h threshold)
    expect(deriveStatus(booking('Draft', '2026-06-16', '2026-06-19'), '2026-03-10')).toBe('Draft')
  })

  it('Draft with PendingAcceptance + allDraftsUrgent → Urgent', () => {
    expect(
      deriveStatus(
        booking('Draft', '2026-04-01', '2026-04-05', 'PendingAcceptance'),
        '2026-03-10',
        true,
      ),
    ).toBe('Urgent')
  })

  it('Draft with Confirmed reservation + allDraftsUrgent → Draft', () => {
    expect(
      deriveStatus(
        booking('Draft', '2026-04-01', '2026-04-05', 'Confirmed'),
        '2026-03-10',
        true,
      ),
    ).toBe('Draft')
  })

  it('Draft with startDate within 12h from now → Urgent (operator path)', () => {
    // isUrgentDraft uses Date.now() internally — create a date 2h from now
    const nearFuture = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const dateStr = nearFuture.toISOString().slice(0, 10)
    // allDraftsUrgent = false (operator role), so isUrgentDraft is the code path
    expect(deriveStatus(booking('Draft', dateStr, dateStr), dateStr, false)).toBe('Urgent')
  })
})

// ─── Completed status from backend ───────────────────────────────────────────

describe('deriveStatus — Completed from backend', () => {
  it('Completed + endDate in the past → Completed', () => {
    expect(deriveStatus(booking('Completed', '2026-03-01', '2026-03-05'), '2026-03-10')).toBe('Completed')
  })

  it('Completed + endDate in the future → Upcoming (early completion edge)', () => {
    expect(deriveStatus(booking('Completed', '2026-03-16', '2026-03-19'), '2026-03-10')).toBe('Upcoming')
  })

  it('Completed + endDate === today → Upcoming (day-of boundary)', () => {
    // ISO date string comparison: endDate is NOT strictly < todayStr, so falls through to Upcoming
    expect(deriveStatus(booking('Completed', '2026-03-16', '2026-03-19'), '2026-03-19')).toBe('Upcoming')
  })
})

// ─── Unknown status ──────────────────────────────────────────────────────────

describe('deriveStatus — unknown status', () => {
  it('unrecognized status → null', () => {
    expect(deriveStatus(booking('SomeOtherStatus', '2026-03-16', '2026-03-19'), '2026-03-17')).toBeNull()
  })
})
