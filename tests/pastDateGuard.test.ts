import { describe, expect, it, vi } from 'vitest'
import { todayISO, assertNoPastDates } from '../convex/bookings/stateMachine'

describe('todayISO', () => {
  it('returns different dates for timezones with large offset differences during overlap window', () => {
    // Fix time to a moment where it's "tomorrow" in Bangkok but "today" in Honolulu.
    // 2026-03-28T00:30:00 in Bangkok (UTC+7) = 2026-03-27T17:30:00 UTC
    // In Honolulu (UTC-10) that's 2026-03-27T07:30:00 — still March 27.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T17:30:00Z'))

    const bangkokDate = todayISO('Asia/Bangkok')
    const honoluluDate = todayISO('Pacific/Honolulu')

    expect(bangkokDate).toBe('2026-03-28')
    expect(honoluluDate).toBe('2026-03-27')
    expect(bangkokDate).not.toBe(honoluluDate)

    vi.useRealTimers()
  })
})

describe('assertNoPastDates', () => {
  it('does not throw for a date that is today in Honolulu but yesterday in Bangkok', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T17:30:00Z'))

    const sessions = [{ date: '2026-03-27', timezone: 'Pacific/Honolulu' }]

    expect(() => assertNoPastDates(sessions, 'Pacific/Honolulu')).not.toThrow()
    expect(() => assertNoPastDates(sessions, 'Asia/Bangkok')).toThrow()

    vi.useRealTimers()
  })

  it('does not throw for future date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T12:00:00Z'))

    const sessions = [{ date: '2026-03-29' }]
    expect(() => assertNoPastDates(sessions, 'Asia/Bangkok')).not.toThrow()

    vi.useRealTimers()
  })

  it('does not throw for empty sessions array', () => {
    expect(() => assertNoPastDates([])).not.toThrow()
  })

  it('throws with PAST_DATE error code', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-28T12:00:00Z'))

    const sessions = [{ date: '2026-03-27' }]
    try {
      assertNoPastDates(sessions, 'Asia/Bangkok')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as { data: { code: string } }).data.code).toBe('PAST_DATE')
    }

    vi.useRealTimers()
  })

  it('checks all sessions, not just the first', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-28T12:00:00Z'))

    const sessions = [
      { date: '2026-03-29' },
      { date: '2026-03-25' }, // past
    ]
    expect(() => assertNoPastDates(sessions, 'Asia/Bangkok')).toThrow()

    vi.useRealTimers()
  })
})
