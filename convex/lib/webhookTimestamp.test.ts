import { describe, it, expect } from 'vitest'
import { isTimestampFresh, TIMESTAMP_TOLERANCE_SECONDS } from './webhookTimestamp'

const FIXED_NOW_MS = 1_000_000_000
const FIXED_NOW_SEC = FIXED_NOW_MS / 1000

describe('isTimestampFresh', () => {
  it('accepts a timestamp that is exactly now', () => {
    expect(isTimestampFresh(String(FIXED_NOW_SEC), FIXED_NOW_MS)).toBe(true)
  })

  it.each([
    ['1 second before tolerance', TIMESTAMP_TOLERANCE_SECONDS - 1, true],
    ['at tolerance', TIMESTAMP_TOLERANCE_SECONDS, true],
    ['1 second past tolerance', TIMESTAMP_TOLERANCE_SECONDS + 1, false],
  ])('past boundary: %s (%d seconds ago)', (_label, offset, expected) => {
    expect(isTimestampFresh(String(FIXED_NOW_SEC - offset), FIXED_NOW_MS)).toBe(expected)
  })

  it.each([
    ['1 second before tolerance', TIMESTAMP_TOLERANCE_SECONDS - 1, true],
    ['at tolerance', TIMESTAMP_TOLERANCE_SECONDS, true],
    ['1 second past tolerance', TIMESTAMP_TOLERANCE_SECONDS + 1, false],
  ])('future boundary: %s (%d seconds ahead)', (_label, offset, expected) => {
    expect(isTimestampFresh(String(FIXED_NOW_SEC + offset), FIXED_NOW_MS)).toBe(expected)
  })

  it.each(['', 'not-a-number', '0'])('rejects invalid input %j', (input) => {
    expect(isTimestampFresh(input, FIXED_NOW_MS)).toBe(false)
  })
})
