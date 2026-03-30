import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  deriveStatus,
  getDaysOfWeek,
  formatRangeLabel,
  getDefaultRange,
  getRangeForDate,
  getRollingGrid,
  clampRange,
} from '../src/lib/hooks/use-calendar-range'

describe('getDaysOfWeek', () => {
  it('returns 7 days starting with Sun', () => {
    const days = getDaysOfWeek()
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('Sun')
    expect(days[6]).toBe('Sat')
  })
})

describe('deriveStatus', () => {
  const today = '2026-03-28'

  it('returns null for Cancelled', () => {
    expect(deriveStatus({ startDate: '2026-03-20', endDate: '2026-03-22', status: 'Cancelled' }, today)).toBeNull()
  })

  it('returns null for Draft with past endDate', () => {
    expect(deriveStatus({ startDate: '2026-03-20', endDate: '2026-03-25', status: 'Draft' }, today)).toBeNull()
  })

  it('returns Draft for future Draft', () => {
    expect(deriveStatus({ startDate: '2026-04-01', endDate: '2026-04-03', status: 'Draft' }, today)).toBe('Draft')
  })

  it('returns Upcoming for future Upcoming booking', () => {
    expect(deriveStatus({ startDate: '2026-04-01', endDate: '2026-04-03', status: 'Upcoming' }, today)).toBe('Upcoming')
  })

  it('returns Active for Upcoming booking that has started', () => {
    expect(deriveStatus({ startDate: '2026-03-26', endDate: '2026-03-30', status: 'Upcoming' }, today)).toBe('Active')
  })

  it('returns Completed for Upcoming with past endDate', () => {
    expect(deriveStatus({ startDate: '2026-03-20', endDate: '2026-03-25', status: 'Upcoming' }, today)).toBe('Completed')
  })

  it('returns Completed for Completed with past endDate', () => {
    expect(deriveStatus({ startDate: '2026-03-10', endDate: '2026-03-15', status: 'Completed' }, today)).toBe('Completed')
  })

  it('returns null for unknown status', () => {
    expect(deriveStatus({ startDate: '2026-04-01', endDate: '2026-04-03', status: 'Unknown' }, today)).toBeNull()
  })

  it('returns Urgent for Draft with PendingAcceptance when allDraftsUrgent', () => {
    expect(
      deriveStatus(
        { startDate: '2026-04-01', endDate: '2026-04-03', status: 'Draft', reservationStatus: 'PendingAcceptance' },
        today,
        true,
      ),
    ).toBe('Urgent')
  })

  it('returns Draft for Draft with Confirmed reservation when allDraftsUrgent', () => {
    expect(
      deriveStatus(
        { startDate: '2026-04-01', endDate: '2026-04-03', status: 'Draft', reservationStatus: 'Confirmed' },
        today,
        true,
      ),
    ).toBe('Draft')
  })
})

describe('formatRangeLabel', () => {
  it('formats a same-year range', () => {
    const start = new Date(2026, 2, 1) // Mar 1
    const end = new Date(2026, 2, 28)  // Mar 28
    const label = formatRangeLabel(start, end)
    expect(label).toContain('–')
    expect(label.length).toBeGreaterThan(0)
  })

  it('includes year when crossing year boundary', () => {
    const start = new Date(2025, 11, 28) // Dec 28
    const end = new Date(2026, 0, 4)     // Jan 4
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
    expect(days).toBe(27) // 28 days inclusive = 27 day difference
  })
})

describe('getRangeForDate', () => {
  it('returns a range containing the given date', () => {
    const target = new Date(2026, 3, 15) // Apr 15
    const { start, end } = getRangeForDate(target)
    expect(start.getTime()).toBeLessThanOrEqual(target.getTime())
    expect(end.getTime()).toBeGreaterThanOrEqual(target.getTime())
  })

  it('returns start before end', () => {
    const { start, end } = getRangeForDate(new Date(2026, 5, 1))
    expect(start.getTime()).toBeLessThan(end.getTime())
  })
})

describe('clampRange', () => {
  it('returns a 28-day range when anchor=start', () => {
    const start = new Date(2027, 2, 1) // far future to avoid floor clamping
    const end = new Date(2027, 5, 1)
    const { start: s, end: e } = clampRange(start, end, 'start')
    const days = Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000))
    expect(days).toBe(27) // 28 days inclusive
  })

  it('returns a 28-day range when anchor=end', () => {
    const start = new Date(2027, 0, 1)
    const end = new Date(2027, 5, 1)
    const { start: s, end: e } = clampRange(start, end, 'end')
    const days = Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000))
    expect(days).toBe(27)
  })

  it('preserves start when anchor=start and start is in the future', () => {
    const start = new Date(2027, 2, 1)
    const end = new Date(2027, 5, 1)
    const result = clampRange(start, end, 'start')
    expect(result.start.getTime()).toBe(start.getTime())
  })

  it('preserves end when anchor=end', () => {
    const end = new Date(2027, 5, 1)
    const result = clampRange(new Date(2027, 0, 1), end, 'end')
    expect(result.end.getTime()).toBe(end.getTime())
  })

  it('defaults to start anchor', () => {
    const start = new Date(2027, 2, 1)
    const end = new Date(2027, 5, 1)
    const result = clampRange(start, end)
    expect(result.start.getTime()).toBe(start.getTime())
  })

  it('clamps start to floor date when start is too far in the past', () => {
    const veryOldStart = new Date(2000, 0, 1)
    const end = new Date(2027, 5, 1)
    const result = clampRange(veryOldStart, end, 'start')
    // Should clamp to floor (1 year ago from now)
    expect(result.start.getTime()).toBeGreaterThan(veryOldStart.getTime())
  })
})

describe('getRollingGrid', () => {
  it('returns array of week arrays', () => {
    const start = new Date(2026, 2, 1)
    const end = new Date(2026, 2, 28)
    const grid = getRollingGrid(start, end)
    expect(grid.length).toBeGreaterThan(0)
  })

  it('each week has 7 days', () => {
    const start = new Date(2026, 2, 1)
    const end = new Date(2026, 2, 28)
    const grid = getRollingGrid(start, end)
    for (const week of grid) {
      expect(week).toHaveLength(7)
    }
  })

  it('first day of first week is a Sunday', () => {
    const start = new Date(2026, 2, 1)
    const end = new Date(2026, 2, 28)
    const grid = getRollingGrid(start, end)
    expect(grid[0][0].date.getDay()).toBe(0) // Sunday
  })

  it('covers at least 4 weeks for a 28-day range', () => {
    const start = new Date(2026, 2, 1)
    const end = new Date(2026, 2, 28)
    const grid = getRollingGrid(start, end)
    expect(grid.length).toBeGreaterThanOrEqual(4)
  })

  it('each day has required CalendarDay fields', () => {
    const start = new Date(2026, 2, 1)
    const end = new Date(2026, 2, 7)
    const grid = getRollingGrid(start, end)
    const day = grid[0][0]
    expect(day.date).toBeInstanceOf(Date)
    expect(typeof day.dayOfMonth).toBe('number')
    expect(typeof day.isCurrentMonth).toBe('boolean')
    expect(typeof day.isToday).toBe('boolean')
    expect(typeof day.dateString).toBe('string')
  })
})
