import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatDateRange,
  statusVariant,
  computeTTLLabel,
  reservationVariant,
} from '../booking-display'

// ── formatDateRange ─────────────────────────────────────────────────────────

describe('formatDateRange', () => {
  it('returns single date when start equals end', () => {
    expect(formatDateRange('2026-03-01', '2026-03-01')).toBe('2026-03-01')
  })

  it('returns range with en-dash when dates differ', () => {
    expect(formatDateRange('2026-03-01', '2026-03-05')).toBe('2026-03-01 – 2026-03-05')
  })

  it('returns dash when both are empty', () => {
    expect(formatDateRange('', '')).toBe('–')
  })

  it('returns start when end is empty', () => {
    expect(formatDateRange('2026-03-01', '')).toBe('2026-03-01')
  })
})

// ── statusVariant ───────────────────────────────────────────────────────────

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

  it('maps unknown status to default', () => {
    expect(statusVariant('SomeFutureStatus')).toBe('default')
  })
})

// ── computeTTLLabel ─────────────────────────────────────────────────────────

describe('computeTTLLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when expiresAt is undefined', () => {
    expect(computeTTLLabel(undefined)).toBeNull()
  })

  it('returns Expired when expiresAt is in the past', () => {
    const pastTs = Date.now() - 60_000
    expect(computeTTLLabel(pastTs)).toBe('Expired')
  })

  it('returns hours and minutes when more than 1 hour remains', () => {
    const futureTs = Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000 // 2h 30m
    expect(computeTTLLabel(futureTs)).toBe('2h 30m remaining')
  })

  it('returns only minutes when less than 1 hour remains', () => {
    const futureTs = Date.now() + 45 * 60 * 1000 // 45m
    expect(computeTTLLabel(futureTs)).toBe('45m remaining')
  })

  it('returns Expired when expiresAt equals now', () => {
    expect(computeTTLLabel(Date.now())).toBe('Expired')
  })
})

// ── reservationVariant ──────────────────────────────────────────────────────

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

  it('maps undefined to default', () => {
    expect(reservationVariant(undefined)).toBe('default')
  })

  it('maps unknown status to default', () => {
    expect(reservationVariant('Something')).toBe('default')
  })
})
