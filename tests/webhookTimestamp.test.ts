import { describe, it, expect } from 'vitest'
import {
  isTimestampFresh,
  TIMESTAMP_TOLERANCE_SECONDS,
} from '../convex/lib/webhookTimestamp'

describe('isTimestampFresh', () => {
  const NOW_MS = 1_700_000_000_000 // arbitrary fixed point
  const NOW_SEC = Math.floor(NOW_MS / 1000)

  it('returns true for a timestamp exactly at now', () => {
    expect(isTimestampFresh(String(NOW_SEC), NOW_MS)).toBe(true)
  })

  it('returns true for a timestamp within tolerance in the past', () => {
    const ts = NOW_SEC - TIMESTAMP_TOLERANCE_SECONDS + 1
    expect(isTimestampFresh(String(ts), NOW_MS)).toBe(true)
  })

  it('returns true for a timestamp at the tolerance boundary (past)', () => {
    const ts = NOW_SEC - TIMESTAMP_TOLERANCE_SECONDS
    expect(isTimestampFresh(String(ts), NOW_MS)).toBe(true)
  })

  it('returns false for a timestamp just beyond tolerance in the past', () => {
    const ts = NOW_SEC - TIMESTAMP_TOLERANCE_SECONDS - 1
    expect(isTimestampFresh(String(ts), NOW_MS)).toBe(false)
  })

  it('returns true for a timestamp within tolerance in the future (clock skew)', () => {
    const ts = NOW_SEC + TIMESTAMP_TOLERANCE_SECONDS - 1
    expect(isTimestampFresh(String(ts), NOW_MS)).toBe(true)
  })

  it('returns true for a timestamp at the tolerance boundary (future)', () => {
    const ts = NOW_SEC + TIMESTAMP_TOLERANCE_SECONDS
    expect(isTimestampFresh(String(ts), NOW_MS)).toBe(true)
  })

  it('returns false for a timestamp just beyond tolerance in the future', () => {
    const ts = NOW_SEC + TIMESTAMP_TOLERANCE_SECONDS + 1
    expect(isTimestampFresh(String(ts), NOW_MS)).toBe(false)
  })

  it('returns false for non-numeric input', () => {
    expect(isTimestampFresh('not-a-number', NOW_MS)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isTimestampFresh('', NOW_MS)).toBe(false)
  })

  it('returns false for zero timestamp', () => {
    expect(isTimestampFresh('0', NOW_MS)).toBe(false)
  })

  it('returns false for Infinity', () => {
    expect(isTimestampFresh('Infinity', NOW_MS)).toBe(false)
  })

  it('returns false for NaN', () => {
    expect(isTimestampFresh('NaN', NOW_MS)).toBe(false)
  })
})
