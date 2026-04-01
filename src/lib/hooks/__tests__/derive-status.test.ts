import { describe, it, expect } from 'vitest'
import { deriveStatus } from '../use-calendar-range'
import { addDays, toISODateString } from '../../utils/date'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function booking(
  status: string,
  startDate: string,
  endDate: string,
  reservationStatus?: string,
) {
  return { status, startDate, endDate, reservationStatus }
}

function relDate(base: string, offset: number): string {
  return addDays(base, offset)
}

// ─── Active derivation (day-level boundaries) ────────────────────────────────

describe('deriveStatus — Active boundaries', () => {
  const start = '2030-06-10'
  const end = relDate(start, 3)

  it('day before first session → Upcoming', () => {
    expect(deriveStatus(booking('Upcoming', start, end), relDate(start, -1))).toBe('Upcoming')
  })

  it('first session date → Active', () => {
    expect(deriveStatus(booking('Upcoming', start, end), start)).toBe('Active')
  })

  it('mid-course date → Active', () => {
    expect(deriveStatus(booking('Upcoming', start, end), relDate(start, 1))).toBe('Active')
  })

  it('last session date → Active', () => {
    expect(deriveStatus(booking('Upcoming', start, end), end)).toBe('Active')
  })

  it('day after last session → Completed', () => {
    expect(deriveStatus(booking('Upcoming', start, end), relDate(end, 1))).toBe('Completed')
  })
})

// ─── Single-day booking ──────────────────────────────────────────────────────

describe('deriveStatus — single-day booking', () => {
  const date = '2030-06-15'

  it('day-of → Active', () => {
    expect(deriveStatus(booking('Upcoming', date, date), date)).toBe('Active')
  })

  it('day after → Completed', () => {
    expect(deriveStatus(booking('Upcoming', date, date), relDate(date, 1))).toBe('Completed')
  })

  it('day before → Upcoming', () => {
    expect(deriveStatus(booking('Upcoming', date, date), relDate(date, -1))).toBe('Upcoming')
  })
})

// ─── Cancelled bookings ──────────────────────────────────────────────────────

describe('deriveStatus — Cancelled', () => {
  it('Cancelled on any date → null (hidden)', () => {
    expect(deriveStatus(booking('Cancelled', '2030-06-10', '2030-06-13'), '2030-06-11')).toBeNull()
  })

  it('Cancelled before start → null', () => {
    expect(deriveStatus(booking('Cancelled', '2030-06-10', '2030-06-13'), '2030-06-05')).toBeNull()
  })
})

// ─── Draft bookings ──────────────────────────────────────────────────────────

describe('deriveStatus — Draft', () => {
  it('Draft with endDate in the past → null (hidden)', () => {
    expect(deriveStatus(booking('Draft', '2030-01-01', '2030-01-05'), '2030-01-10')).toBeNull()
  })

  it('Draft with endDate in the future → Draft', () => {
    expect(deriveStatus(booking('Draft', '2030-09-10', '2030-09-13'), '2030-06-10')).toBe('Draft')
  })

  it('Draft with PendingAcceptance + allDraftsUrgent → Urgent', () => {
    expect(
      deriveStatus(
        booking('Draft', '2030-06-15', '2030-06-19', 'PendingAcceptance'),
        '2030-06-10',
        true,
      ),
    ).toBe('Urgent')
  })

  it('Draft with Confirmed reservation + allDraftsUrgent → Draft', () => {
    expect(
      deriveStatus(
        booking('Draft', '2030-06-15', '2030-06-19', 'Confirmed'),
        '2030-06-10',
        true,
      ),
    ).toBe('Draft')
  })

  it('Draft with startDate within 12h from now → Urgent (operator path)', () => {
    const nearFuture = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const dateStr = toISODateString(nearFuture)
    expect(deriveStatus(booking('Draft', dateStr, dateStr), dateStr, false)).toBe('Urgent')
  })
})

// ─── Completed status from backend ───────────────────────────────────────────

describe('deriveStatus — Completed from backend', () => {
  it('Completed + endDate in the past → Completed', () => {
    expect(deriveStatus(booking('Completed', '2030-01-01', '2030-01-05'), '2030-01-10')).toBe('Completed')
  })

  it('Completed + endDate in the future → Upcoming (early completion edge)', () => {
    expect(deriveStatus(booking('Completed', '2030-06-10', '2030-06-13'), '2030-06-05')).toBe('Upcoming')
  })

  it('Completed + endDate === today → Upcoming (day-of boundary)', () => {
    expect(deriveStatus(booking('Completed', '2030-06-10', '2030-06-13'), '2030-06-13')).toBe('Upcoming')
  })
})

// ─── Unknown status ──────────────────────────────────────────────────────────

describe('deriveStatus — unknown status', () => {
  it('unrecognized status → null', () => {
    expect(deriveStatus(booking('SomeOtherStatus', '2030-06-10', '2030-06-13'), '2030-06-11')).toBeNull()
  })
})
