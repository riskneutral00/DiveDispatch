import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatDateRange,
  statusVariant,
  reservationVariant,
  computeTTLLabel,
} from '../booking-display'

describe('formatDateRange', () => {
  it('returns en-dash for empty start and end', () => {
    expect(formatDateRange('', '')).toBe('\u2013')
  })

  it('returns single date when start equals end', () => {
    expect(formatDateRange('2026-03-15', '2026-03-15')).toBe('2026-03-15')
    expect(formatDateRange('2026-03-01', '2026-03-01')).toBe('2026-03-01')
  })

  it('returns start only when end is empty', () => {
    expect(formatDateRange('2026-03-15', '')).toBe('2026-03-15')
    expect(formatDateRange('2026-03-01', '')).toBe('2026-03-01')
  })

  it('formats a proper range with en-dash', () => {
    expect(formatDateRange('2026-03-15', '2026-03-18')).toBe('2026-03-15 \u2013 2026-03-18')
    expect(formatDateRange('2026-03-01', '2026-03-05')).toBe('2026-03-01 \u2013 2026-03-05')
  })
})

describe('statusVariant', () => {
  it('returns warning for Draft', () => {
    expect(statusVariant('Draft')).toBe('warning')
  })

  it('returns info for Upcoming', () => {
    expect(statusVariant('Upcoming')).toBe('info')
  })

  it('returns success for Completed', () => {
    expect(statusVariant('Completed')).toBe('success')
  })

  it('returns destructive for Cancelled', () => {
    expect(statusVariant('Cancelled')).toBe('destructive')
  })

  it('returns default for unknown status', () => {
    expect(statusVariant('SomethingElse')).toBe('default')
    expect(statusVariant('SomeFutureStatus')).toBe('default')
  })
})

describe('reservationVariant', () => {
  it('returns success for Confirmed', () => {
    expect(reservationVariant('Confirmed')).toBe('success')
  })

  it('returns warning for PendingAcceptance', () => {
    expect(reservationVariant('PendingAcceptance')).toBe('warning')
  })

  it('returns destructive for Vacated', () => {
    expect(reservationVariant('Vacated')).toBe('destructive')
  })

  it('returns destructive for NoShow', () => {
    expect(reservationVariant('NoShow')).toBe('destructive')
  })

  it('returns default for undefined', () => {
    expect(reservationVariant(undefined)).toBe('default')
  })

  it('returns default for unknown status', () => {
    expect(reservationVariant('Unknown')).toBe('default')
    expect(reservationVariant('Something')).toBe('default')
  })
})

describe('computeTTLLabel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when expiresAt is undefined', () => {
    expect(computeTTLLabel(undefined)).toBeNull()
  })

  it('returns null when expiresAt is 0', () => {
    expect(computeTTLLabel(0)).toBeNull()
  })

  it('returns Expired when expiresAt is in the past', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2000)
    expect(computeTTLLabel(1000)).toBe('Expired')
  })

  it('returns hours and minutes when > 1 hour remaining', () => {
    vi.spyOn(Date, 'now').mockReturnValue(0)
    expect(computeTTLLabel(9_000_000)).toBe('2h 30m remaining')
  })

  it('returns only minutes when < 1 hour remaining', () => {
    vi.spyOn(Date, 'now').mockReturnValue(0)
    expect(computeTTLLabel(2_700_000)).toBe('45m remaining')
  })

  it('returns 0m remaining when exactly at expiry boundary', () => {
    vi.spyOn(Date, 'now').mockReturnValue(999)
    expect(computeTTLLabel(1000)).toBe('0m remaining')
  })

  it('returns Expired when expiresAt equals now', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5000)
    expect(computeTTLLabel(5000)).toBe('Expired')
  })
})
