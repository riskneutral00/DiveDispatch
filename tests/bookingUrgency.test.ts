import { describe, it, expect, vi, afterEach } from 'vitest'
import { isUrgentDraft, urgentCountdown } from '../src/lib/utils/booking-urgency'

describe('isUrgentDraft', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true for a Draft booking starting within 12 hours', () => {
    const startDate = '2026-03-29'
    const startMs = new Date(2026, 2, 29).getTime()
    vi.spyOn(Date, 'now').mockReturnValue(startMs - 6 * 60 * 60 * 1000)
    expect(isUrgentDraft({ status: 'Draft', startDate })).toBe(true)
  })

  it('returns false for a Draft booking starting more than 12 hours away', () => {
    const startDate = '2026-03-29'
    const startMs = new Date(2026, 2, 29).getTime()
    vi.spyOn(Date, 'now').mockReturnValue(startMs - 24 * 60 * 60 * 1000)
    expect(isUrgentDraft({ status: 'Draft', startDate })).toBe(false)
  })

  it('returns false for non-Draft status even if start is imminent', () => {
    const startDate = '2026-03-29'
    const startMs = new Date(2026, 2, 29).getTime()
    vi.spyOn(Date, 'now').mockReturnValue(startMs - 1000)
    expect(isUrgentDraft({ status: 'Upcoming', startDate })).toBe(false)
  })

  it('returns true for a Draft booking that has already started', () => {
    const startDate = '2026-03-29'
    const startMs = new Date(2026, 2, 29).getTime()
    vi.spyOn(Date, 'now').mockReturnValue(startMs + 1000)
    expect(isUrgentDraft({ status: 'Draft', startDate })).toBe(true)
  })
})

describe('urgentCountdown', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null for non-urgent bookings', () => {
    const startDate = '2026-03-29'
    const startMs = new Date(2026, 2, 29).getTime()
    vi.spyOn(Date, 'now').mockReturnValue(startMs - 24 * 60 * 60 * 1000)
    expect(urgentCountdown({ status: 'Draft', startDate })).toBeNull()
  })

  it('returns "Started" when start date is in the past', () => {
    const startDate = '2026-03-29'
    const startMs = new Date(2026, 2, 29).getTime()
    vi.spyOn(Date, 'now').mockReturnValue(startMs + 1000)
    expect(urgentCountdown({ status: 'Draft', startDate })).toBe('Started')
  })

  it('returns hours format when > 1 hour remaining', () => {
    const startDate = '2026-03-29'
    const startMs = new Date(2026, 2, 29).getTime()
    vi.spyOn(Date, 'now').mockReturnValue(startMs - 3 * 60 * 60 * 1000)
    expect(urgentCountdown({ status: 'Draft', startDate })).toBe('Starts in 3h')
  })

  it('returns minutes format when < 1 hour remaining', () => {
    const startDate = '2026-03-29'
    const startMs = new Date(2026, 2, 29).getTime()
    vi.spyOn(Date, 'now').mockReturnValue(startMs - 30 * 60 * 1000)
    expect(urgentCountdown({ status: 'Draft', startDate })).toBe('Starts in 30m')
  })
})
