import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatDateRange,
  statusVariant,
  reservationVariant,
  computeTTLLabel,
} from '../../src/lib/booking/booking-display'

describe('formatDateRange', () => {
  it('returns en-dash for empty start and end', () => {
    expect(formatDateRange('', '')).toBe('\u2013')
  })

  it('returns start only when start equals end', () => {
    expect(formatDateRange('2026-04-01', '2026-04-01')).toBe('2026-04-01')
  })

  it('returns start only when end is empty', () => {
    expect(formatDateRange('2026-04-01', '')).toBe('2026-04-01')
  })

  it('returns range with en-dash separator', () => {
    expect(formatDateRange('2026-04-01', '2026-04-05')).toBe('2026-04-01 \u2013 2026-04-05')
  })
})

describe('statusVariant', () => {
  it('maps Draft to warning', () => {
    expect(statusVariant('Draft')).toBe('warning')
  })

  it('maps Upcoming to info', () => {
    expect(statusVariant('Upcoming')).toBe('info')
  })

  it('maps Completed to success', () => {
    expect(statusVariant('Completed')).toBe('success')
  })

  it('maps Cancelled to destructive', () => {
    expect(statusVariant('Cancelled')).toBe('destructive')
  })

  it('returns default for unknown status', () => {
    expect(statusVariant('UnknownStatus')).toBe('default')
  })
})

describe('reservationVariant', () => {
  it('maps Confirmed to success', () => {
    expect(reservationVariant('Confirmed')).toBe('success')
  })

  it('maps PendingAcceptance to warning', () => {
    expect(reservationVariant('PendingAcceptance')).toBe('warning')
  })

  it('maps Vacated to destructive', () => {
    expect(reservationVariant('Vacated')).toBe('destructive')
  })

  it('maps NoShow to destructive', () => {
    expect(reservationVariant('NoShow')).toBe('destructive')
  })

  it('returns default for undefined', () => {
    expect(reservationVariant(undefined)).toBe('default')
  })

  it('returns default for unknown status', () => {
    expect(reservationVariant('Something')).toBe('default')
  })
})

describe('computeTTLLabel', () => {
  const NOW = 1_700_000_000_000

  afterEach(() => vi.useRealTimers())

  function setup() {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  }

  it('returns null for undefined expiresAt', () => {
    expect(computeTTLLabel(undefined)).toBeNull()
  })

  it('returns null for 0 expiresAt', () => {
    expect(computeTTLLabel(0)).toBeNull()
  })

  it('returns "Expired" when expiresAt is in the past', () => {
    setup()
    expect(computeTTLLabel(NOW - 1000)).toBe('Expired')
  })

  it('returns minutes only when less than 1 hour remaining', () => {
    setup()
    expect(computeTTLLabel(NOW + 30 * 60 * 1000)).toBe('30m remaining')
  })

  it('returns hours and minutes when more than 1 hour remaining', () => {
    setup()
    expect(computeTTLLabel(NOW + 2 * 60 * 60 * 1000 + 15 * 60 * 1000)).toBe('2h 15m remaining')
  })

  it('returns "0m remaining" at exact expiry boundary', () => {
    setup()
    expect(computeTTLLabel(NOW)).toBe('Expired')
  })
})
