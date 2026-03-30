import { describe, it, expect, vi, afterEach } from 'vitest'
import { timeAgo } from '../../src/lib/utils/time-ago'

describe('timeAgo', () => {
  const NOW = 1_700_000_000_000

  afterEach(() => vi.useRealTimers())

  function setup() {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  }

  it('returns "just now" for timestamps less than 1 minute ago', () => {
    setup()
    expect(timeAgo(NOW)).toBe('just now')
    expect(timeAgo(NOW - 30_000)).toBe('just now')
    expect(timeAgo(NOW - 59_999)).toBe('just now')
  })

  it('returns minutes for 1-59 minutes ago', () => {
    setup()
    expect(timeAgo(NOW - 60_000)).toBe('1m ago')
    expect(timeAgo(NOW - 5 * 60_000)).toBe('5m ago')
    expect(timeAgo(NOW - 59 * 60_000)).toBe('59m ago')
  })

  it('returns hours for 1-23 hours ago', () => {
    setup()
    expect(timeAgo(NOW - 60 * 60_000)).toBe('1h ago')
    expect(timeAgo(NOW - 12 * 60 * 60_000)).toBe('12h ago')
    expect(timeAgo(NOW - 23 * 60 * 60_000)).toBe('23h ago')
  })

  it('returns days for 24+ hours ago', () => {
    setup()
    expect(timeAgo(NOW - 24 * 60 * 60_000)).toBe('1d ago')
    expect(timeAgo(NOW - 7 * 24 * 60 * 60_000)).toBe('7d ago')
    expect(timeAgo(NOW - 365 * 24 * 60 * 60_000)).toBe('365d ago')
  })

  it('handles exact boundary: 60 minutes = 1h', () => {
    setup()
    expect(timeAgo(NOW - 60 * 60_000)).toBe('1h ago')
  })

  it('handles exact boundary: 24 hours = 1d', () => {
    setup()
    expect(timeAgo(NOW - 24 * 60 * 60_000)).toBe('1d ago')
  })
})
