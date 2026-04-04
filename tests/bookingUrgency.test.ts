import { describe, it, expect, vi, afterEach } from 'vitest'
import { isUrgentDraft, urgentCountdown } from '../src/lib/utils/booking-urgency'
import { testDate } from './helpers/dates'

/** Parse a date string the same way the production code does (local midnight). */
function localMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

describe('isUrgentDraft', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true for a Draft booking starting within 12 hours', () => {
    const startDate = testDate(30)
    vi.spyOn(Date, 'now').mockReturnValue(localMs(startDate) - 6 * 60 * 60 * 1000)
    expect(isUrgentDraft({ status: 'Draft', startDate })).toBe(true)
  })

  it('returns false for a Draft booking starting more than 12 hours away', () => {
    const startDate = testDate(30)
    vi.spyOn(Date, 'now').mockReturnValue(localMs(startDate) - 24 * 60 * 60 * 1000)
    expect(isUrgentDraft({ status: 'Draft', startDate })).toBe(false)
  })

  it('returns false for non-Draft status even if start is imminent', () => {
    const startDate = testDate(30)
    vi.spyOn(Date, 'now').mockReturnValue(localMs(startDate) - 1000)
    expect(isUrgentDraft({ status: 'Upcoming', startDate })).toBe(false)
  })

  it('returns true for a Draft booking that has already started', () => {
    const startDate = testDate(30)
    vi.spyOn(Date, 'now').mockReturnValue(localMs(startDate) + 1000)
    expect(isUrgentDraft({ status: 'Draft', startDate })).toBe(true)
  })
})

describe('urgentCountdown', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null for non-urgent bookings', () => {
    const startDate = testDate(30)
    vi.spyOn(Date, 'now').mockReturnValue(localMs(startDate) - 24 * 60 * 60 * 1000)
    expect(urgentCountdown({ status: 'Draft', startDate })).toBeNull()
  })

  it('returns "Started" when start date is in the past', () => {
    const startDate = testDate(30)
    vi.spyOn(Date, 'now').mockReturnValue(localMs(startDate) + 1000)
    expect(urgentCountdown({ status: 'Draft', startDate })).toBe('Started')
  })

  it('returns hours format when > 1 hour remaining', () => {
    const startDate = testDate(30)
    vi.spyOn(Date, 'now').mockReturnValue(localMs(startDate) - 3 * 60 * 60 * 1000)
    expect(urgentCountdown({ status: 'Draft', startDate })).toBe('Starts in 3h')
  })

  it('returns minutes format when < 1 hour remaining', () => {
    const startDate = testDate(30)
    vi.spyOn(Date, 'now').mockReturnValue(localMs(startDate) - 30 * 60 * 1000)
    expect(urgentCountdown({ status: 'Draft', startDate })).toBe('Starts in 30m')
  })
})
