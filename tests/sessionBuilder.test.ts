import { describe, it, expect } from 'vitest'
import {
  getDeliveryLocation,
  getDatesInRange,
} from '../src/lib/booking/session-builder'
import { testDate } from './helpers/dates'

describe('getDeliveryLocation', () => {
  it('returns Pool for confined days regardless of venue', () => {
    expect(getDeliveryLocation(true, 'Boat')).toBe('Pool')
    expect(getDeliveryLocation(true, 'Shore')).toBe('Pool')
    expect(getDeliveryLocation(true)).toBe('Pool')
  })

  it('returns BoatPier for non-confined boat days', () => {
    expect(getDeliveryLocation(false, 'Boat')).toBe('BoatPier')
  })

  it('returns Beach for non-confined shore days', () => {
    expect(getDeliveryLocation(false, 'Shore')).toBe('Beach')
  })

  it('defaults to BoatPier when venue is omitted', () => {
    expect(getDeliveryLocation(false)).toBe('BoatPier')
  })
})

describe('getDatesInRange', () => {
  it('returns single date for same start and end', () => {
    const d = testDate(0)
    expect(getDatesInRange(d, d)).toEqual([d])
  })

  it('returns all dates in a range', () => {
    const start = testDate(0)
    const end = testDate(2)
    const result = getDatesInRange(start, end)
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(start)
    expect(result[2]).toBe(end)
  })

  it('returns empty array for empty inputs', () => {
    expect(getDatesInRange('', '')).toEqual([])
  })

  it('returns empty array when start > end', () => {
    expect(getDatesInRange(testDate(5), testDate(0))).toEqual([])
  })

  it('returns empty array for invalid date strings', () => {
    expect(getDatesInRange('not-a-date', 'also-not')).toEqual([])
  })
})
