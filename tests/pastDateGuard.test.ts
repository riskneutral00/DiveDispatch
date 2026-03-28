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
    // Same time trick: Bangkok sees March 28, Honolulu sees March 27.
    // A session on March 27 should pass when timezone is Honolulu,
    // but would fail if we incorrectly defaulted to Bangkok.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T17:30:00Z'))

    const sessions = [{ date: '2026-03-27', timezone: 'Pacific/Honolulu' }]

    // With Honolulu timezone, March 27 is today — should NOT throw
    expect(() => assertNoPastDates(sessions, 'Pacific/Honolulu')).not.toThrow()

    // With Bangkok timezone, March 27 is yesterday — SHOULD throw
    expect(() => assertNoPastDates(sessions, 'Asia/Bangkok')).toThrow()

    vi.useRealTimers()
  })
})
