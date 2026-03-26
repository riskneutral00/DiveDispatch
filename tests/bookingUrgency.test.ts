import { describe, it, expect, vi, afterEach } from 'vitest'
import { urgentCountdown } from '../src/lib/utils/booking-urgency'
import { testDate } from './helpers/dates'

describe('urgentCountdown', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null for non-Draft bookings', () => {
    expect(urgentCountdown({ status: 'Upcoming', startDate: testDate(7) })).toBeNull()
  })

  it('returns null for Draft bookings far in the future', () => {
    expect(urgentCountdown({ status: 'Draft', startDate: testDate(30) })).toBeNull()
  })

  it('returns "Started" when start date has passed', () => {
    vi.useFakeTimers()
    // Set now to 2026-03-25 at noon
    vi.setSystemTime(new Date(2026, 2, 25, 12, 0, 0))
    // Start date is today (midnight) — already past
    expect(urgentCountdown({ status: 'Draft', startDate: '2026-03-25' })).toBe('Started')
  })

  it('returns hours countdown when within 12 hours', () => {
    vi.useFakeTimers()
    // Set now to 2026-03-24 at 8pm — start is midnight 2026-03-25 = 4 hours away
    vi.setSystemTime(new Date(2026, 2, 24, 20, 0, 0))
    const result = urgentCountdown({ status: 'Draft', startDate: '2026-03-25' })
    expect(result).toBe('Starts in 4h')
  })

  it('returns minutes countdown when under 1 hour', () => {
    vi.useFakeTimers()
    // Set now to 2026-03-24 at 23:30 — start is midnight = 30 minutes away
    vi.setSystemTime(new Date(2026, 2, 24, 23, 30, 0))
    const result = urgentCountdown({ status: 'Draft', startDate: '2026-03-25' })
    expect(result).toBe('Starts in 30m')
  })
})
