import { describe, it, expect, vi, afterEach } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  todayISO,
  assertNoPastDates,
  isSessionEnded,
  computeMedicalDeadline,
} from '../convex/bookings/stateMachine'

describe('todayISO', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a string matching YYYY-MM-DD format', () => {
    const result = todayISO('UTC')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('respects timezone parameter', () => {
    // At UTC midnight Jan 1, Bangkok (UTC+7) is already Jan 1 at 7am
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 0, 1, 0, 0, 0))
    const utc = todayISO('UTC')
    const bangkok = todayISO('Asia/Bangkok')
    // Bangkok is UTC+7, so at UTC midnight both should be Jan 1
    expect(utc).toBe('2026-01-01')
    expect(bangkok).toBe('2026-01-01')
  })
})

describe('assertNoPastDates', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not throw for future dates', () => {
    // Mock to a known date
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 0, 15, 12, 0, 0))
    expect(() => assertNoPastDates(
      [{ date: '2026-02-01' }],
      'UTC',
    )).not.toThrow()
  })

  it('throws ConvexError for past dates', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 15, 12, 0, 0))
    try {
      assertNoPastDates([{ date: '2026-01-01' }], 'UTC')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      const data = (err as ConvexError<{ code: string; date: string }>).data
      expect(data.code).toBe('PAST_DATE')
      expect(data.date).toBe('2026-01-01')
    }
  })

  it('does not throw for today', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 0, 15, 12, 0, 0))
    expect(() => assertNoPastDates(
      [{ date: '2026-01-15' }],
      'UTC',
    )).not.toThrow()
  })

  it('throws on first past date only', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 15, 12, 0, 0))
    try {
      assertNoPastDates(
        [{ date: '2026-01-01' }, { date: '2026-01-02' }],
        'UTC',
      )
      expect.fail('should have thrown')
    } catch (err) {
      const data = (err as ConvexError<{ date: string }>).data
      expect(data.date).toBe('2026-01-01')
    }
  })
})

describe('isSessionEnded', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when current date is after session date', () => {
    // Mock: March 16, 2026 at noon UTC
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 16, 12, 0, 0))
    expect(isSessionEnded('2026-03-15', '17:00', 'UTC')).toBe(true)
  })

  it('returns true when same date and current time >= endTime', () => {
    // Mock: March 15, 2026 at 17:30 UTC
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 15, 17, 30, 0))
    expect(isSessionEnded('2026-03-15', '17:00', 'UTC')).toBe(true)
  })

  it('returns false when same date and current time < endTime', () => {
    // Mock: March 15, 2026 at 10:00 UTC
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 15, 10, 0, 0))
    expect(isSessionEnded('2026-03-15', '17:00', 'UTC')).toBe(false)
  })

  it('returns false when current date is before session date', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 14, 18, 0, 0))
    expect(isSessionEnded('2026-03-15', '08:00', 'UTC')).toBe(false)
  })
})

describe('computeMedicalDeadline', () => {
  it('returns the earlier of TTL deadline and 8pm cutoff', () => {
    // Creation at midnight March 14, activity on March 15
    const creationTime = Date.UTC(2026, 2, 14, 0, 0, 0)
    const result = computeMedicalDeadline(creationTime, '2026-03-15', 'UTC')
    
    // TTL: creationTime + 36h = March 15 12:00 UTC
    const ttlDeadline = creationTime + 36 * 60 * 60 * 1000
    // 8pm night before: March 14 20:00 UTC
    const cutoff8pm = Date.UTC(2026, 2, 14, 20, 0, 0)
    
    // Should be the earlier one
    expect(result).toBe(Math.min(ttlDeadline, cutoff8pm))
  })

  it('returns TTL when TTL is earlier than 8pm cutoff', () => {
    // Creation at March 14 19:00 UTC, activity March 20
    const creationTime = Date.UTC(2026, 2, 14, 19, 0, 0)
    const result = computeMedicalDeadline(creationTime, '2026-03-20', 'UTC')
    
    // TTL: creationTime + 36h = March 16 07:00 UTC
    const ttlDeadline = creationTime + 36 * 60 * 60 * 1000
    // 8pm March 19 = much later
    
    expect(result).toBe(ttlDeadline)
  })
})
