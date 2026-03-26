import { describe, it, expect } from 'vitest'
import { isTimestampFresh } from './webhookTimestamp'

describe('isTimestampFresh', () => {
  it('accepts a timestamp that is exactly now', () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    expect(isTimestampFresh(String(nowSeconds))).toBe(true)
  })

  it('accepts a timestamp 299 seconds in the past', () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    expect(isTimestampFresh(String(nowSeconds - 299))).toBe(true)
  })

  it('rejects a timestamp 301 seconds in the past', () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    expect(isTimestampFresh(String(nowSeconds - 301))).toBe(false)
  })

  it('accepts a timestamp 299 seconds in the future (clock skew)', () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    expect(isTimestampFresh(String(nowSeconds + 299))).toBe(true)
  })

  it('rejects a timestamp 301 seconds in the future', () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    expect(isTimestampFresh(String(nowSeconds + 301))).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isTimestampFresh('')).toBe(false)
  })

  it('rejects a non-numeric string', () => {
    expect(isTimestampFresh('not-a-number')).toBe(false)
  })

  it('rejects a zero timestamp (epoch)', () => {
    expect(isTimestampFresh('0')).toBe(false)
  })

  it('boundary: exactly 300 seconds old is accepted', () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    expect(isTimestampFresh(String(nowSeconds - 300))).toBe(true)
  })

  it('boundary: exactly 300 seconds in the future is accepted', () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    expect(isTimestampFresh(String(nowSeconds + 300))).toBe(true)
  })

  it('accepts with a custom nowMs override', () => {
    // Fixed "now" = 1000000 seconds since epoch = 1000000000 ms
    const fixedNowMs = 1_000_000_000
    const fixedNowSec = fixedNowMs / 1000
    expect(isTimestampFresh(String(fixedNowSec), fixedNowMs)).toBe(true)
    expect(isTimestampFresh(String(fixedNowSec - 301), fixedNowMs)).toBe(false)
  })
})
