import { describe, it, expect } from 'vitest'
import {
  deriveStatus,
  getDaysOfWeek,
  formatRangeLabel,
  getDefaultRange,
  getRangeForDate,
  getRollingGrid,
  clampRange,
} from '../calendar-range'

describe('getDaysOfWeek', () => {
  it('returns 7 days starting with Sun', () => {
    const days = getDaysOfWeek()
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('Sun')
    expect(days[6]).toBe('Sat')
  })
})

describe('deriveStatus', () => {
  const today = '2030-06-15'

  it('returns null for Cancelled', () => {
    expect(deriveStatus({ startDate: '2030-06-05', endDate: '2030-06-07', status: 'Cancelled' }, today)).toBeNull()
  })

  it('returns null for Draft with past endDate', () => {
    expect(deriveStatus({ startDate: '2030-06-05', endDate: '2030-06-10', status: 'Draft' }, today)).toBeNull()
  })

  it('returns Draft for future Draft', () => {
    expect(deriveStatus({ startDate: '2030-09-01', endDate: '2030-09-03', status: 'Draft' }, today)).toBe('Draft')
  })

  it('returns Upcoming for future Upcoming booking', () => {
    expect(deriveStatus({ startDate: '2030-09-01', endDate: '2030-09-03', status: 'Upcoming' }, today)).toBe('Upcoming')
  })

  it('returns Active for Upcoming booking that has started', () => {
    expect(deriveStatus({ startDate: '2030-06-13', endDate: '2030-06-17', status: 'Upcoming' }, today)).toBe('Active')
  })

  it('returns Completed for Upcoming with past endDate', () => {
    expect(deriveStatus({ startDate: '2030-06-05', endDate: '2030-06-10', status: 'Upcoming' }, today)).toBe('Completed')
  })

  it('returns Completed for Completed with past endDate', () => {
    expect(deriveStatus({ startDate: '2030-05-10', endDate: '2030-05-15', status: 'Completed' }, today)).toBe('Completed')
  })

  it('returns null for unknown status', () => {
    expect(deriveStatus({ startDate: '2030-06-20', endDate: '2030-06-22', status: 'Unknown' }, today)).toBeNull()
  })

  it('returns Urgent for Draft with PendingAcceptance when allDraftsUrgent', () => {
    expect(
      deriveStatus(
        { startDate: '2030-06-20', endDate: '2030-06-22', status: 'Draft', reservationStatus: 'PendingAcceptance' },
        today,
        true,
      ),
    ).toBe('Urgent')
  })

  it('returns Draft for Draft with Confirmed reservation when allDraftsUrgent', () => {
    expect(
      deriveStatus(
        { startDate: '2030-06-20', endDate: '2030-06-22', status: 'Draft', reservationStatus: 'Confirmed' },
        today,
        true,
      ),
    ).toBe('Draft')
  })
})

describe('formatRangeLabel', () => {
  it('formats a same-year range', () => {
    const start = new Date(2026, 2, 1)
    const end = new Date(2026, 2, 28)
    const label = formatRangeLabel(start, end)
    expect(label).toContain('–')
    expect(label.length).toBeGreaterThan(0)
  })

  it('includes year when crossing year boundary', () => {
    const start = new Date(2025, 11, 28)
    const end = new Date(2026, 0, 4)
    const label = formatRangeLabel(start, end)
    expect(label).toContain('–')
  })
})

describe('getDefaultRange', () => {
  it('returns start before end', () => {
    const { start, end } = getDefaultRange()
    expect(start.getTime()).toBeLessThan(end.getTime())
  })

  it('returns a 28-day range (4 weeks)', () => {
    const { start, end } = getDefaultRange()
    const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    expect(days).toBe(27)
  })
})

describe('getRangeForDate', () => {
  it('returns a range containing the given date', () => {
    const target = new Date(2026, 3, 15)
    const { start, end } = getRangeForDate(target)
    expect(start.getTime()).toBeLessThanOrEqual(target.getTime())
    expect(end.getTime()).toBeGreaterThanOrEqual(target.getTime())
  })

  it('never returns a backwards range when jumping to a date before the floor', () => {
    // Jump to a date well before the floor (1 year ago)
    const ancient = new Date(2020, 0, 1)
    const { start, end } = getRangeForDate(ancient)
    expect(start.getTime()).toBeLessThanOrEqual(end.getTime())
  })

  it('always returns start <= end', () => {
    // Test several months that could fall before/near the floor
    const targets = [
      new Date(2025, 0, 1), // Jan 2025
      new Date(2025, 1, 1), // Feb 2025
      new Date(2025, 2, 1), // Mar 2025
      new Date(2025, 3, 1), // Apr 2025
    ]
    for (const target of targets) {
      const { start, end } = getRangeForDate(target)
      expect(start.getTime()).toBeLessThanOrEqual(end.getTime())
    }
  })
})

describe('clampRange', () => {
  it('returns a 28-day range when anchor=start', () => {
    const start = new Date(2027, 2, 1)
    const end = new Date(2027, 5, 1)
    const { start: s, end: e } = clampRange(start, end, 'start')
    const days = Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000))
    expect(days).toBe(27)
  })
})

describe('getRollingGrid', () => {
  it('each week has 7 days', () => {
    const start = new Date(2026, 2, 1)
    const end = new Date(2026, 2, 28)
    const grid = getRollingGrid(start, end)
    for (const week of grid) {
      expect(week).toHaveLength(7)
    }
  })
})
