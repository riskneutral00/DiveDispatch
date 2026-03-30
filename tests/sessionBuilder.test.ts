import { describe, it, expect } from 'vitest'
import {
  getDeliveryLocation,
  buildSessionsFromDays,
  buildDefaultDays,
} from '../src/lib/booking/session-builder'
import { getDatesInRange } from '../src/lib/utils/date'
import { testDate } from './helpers/dates'
import type { DayConfig } from '../src/lib/booking/wizard-state'

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

describe('buildSessionsFromDays', () => {
  const makeDay = (overrides: Partial<DayConfig> = {}): DayConfig => ({
    date: testDate(0),
    venueType: 'boat',
    dives: [],
    divesPerDay: 2,
    startTime: '08:00',
    endTime: '12:00',
    timezone: 'Asia/Bangkok',
    ...overrides,
  })

  it('returns empty array for empty days', () => {
    expect(buildSessionsFromDays([], 1)).toEqual([])
  })

  it('produces one session per day', () => {
    const days = [makeDay(), makeDay({ date: testDate(1) })]
    const sessions = buildSessionsFromDays(days, 2)
    expect(sessions).toHaveLength(2)
  })

  it('sets deliveryLocation to Pool for pool venueType', () => {
    const days = [makeDay({ venueType: 'pool' })]
    const sessions = buildSessionsFromDays(days, 1)
    expect(sessions[0].deliveryLocation).toBe('Pool')
    expect(sessions[0].isConfinedDay).toBe(true)
    expect(sessions[0].resourceType).toBe('pool')
  })

  it('sets deliveryLocation to BoatPier for boat venueType', () => {
    const days = [makeDay({ venueType: 'boat' })]
    const sessions = buildSessionsFromDays(days, 1)
    expect(sessions[0].deliveryLocation).toBe('BoatPier')
    expect(sessions[0].isConfinedDay).toBe(false)
    expect(sessions[0].resourceType).toBe('boat')
  })

  it('sets deliveryLocation to Beach for shore venueType', () => {
    const days = [makeDay({ venueType: 'shore' })]
    const sessions = buildSessionsFromDays(days, 1)
    expect(sessions[0].deliveryLocation).toBe('Beach')
  })

  it('sets unitsRequested to at least 1', () => {
    const sessions = buildSessionsFromDays([makeDay()], 0)
    expect(sessions[0].unitsRequested).toBe(1)
  })

  it('carries through date, times, timezone', () => {
    const day = makeDay({
      date: testDate(5),
      startTime: '09:00',
      endTime: '14:00',
      timezone: 'Pacific/Auckland',
    })
    const sessions = buildSessionsFromDays([day], 1)
    expect(sessions[0].date).toBe(testDate(5))
    expect(sessions[0].startTime).toBe('09:00')
    expect(sessions[0].endTime).toBe('14:00')
    expect(sessions[0].timezone).toBe('Pacific/Auckland')
  })
})

describe('buildDefaultDays', () => {
  it('returns empty for invalid date range', () => {
    expect(buildDefaultDays(testDate(5), testDate(0), ['OW'])).toEqual([])
  })

  it('generates days for OW course', () => {
    const days = buildDefaultDays(testDate(0), testDate(2), ['OW'])
    expect(days).toHaveLength(3)
    expect(days[0].date).toBe(testDate(0))
    expect(days[2].date).toBe(testDate(2))
  })

  it('first day is pool when course requires confined', () => {
    const days = buildDefaultDays(testDate(0), testDate(2), ['OW'])
    expect(days[0].venueType).toBe('pool')
    expect(days[0].startTime).toBe('09:00')
  })

  it('non-first days are boat', () => {
    const days = buildDefaultDays(testDate(0), testDate(2), ['OW'])
    expect(days[1].venueType).toBe('boat')
    expect(days[1].startTime).toBe('08:00')
  })

  it('uses provided timezone', () => {
    const days = buildDefaultDays(testDate(0), testDate(0), ['FD'], 'Europe/London')
    expect(days[0].timezone).toBe('Europe/London')
  })

  it('defaults timezone to Asia/Bangkok', () => {
    const days = buildDefaultDays(testDate(0), testDate(0), ['FD'])
    expect(days[0].timezone).toBe('Asia/Bangkok')
  })

  it('no confined day for FD course', () => {
    const days = buildDefaultDays(testDate(0), testDate(0), ['FD'])
    expect(days[0].venueType).toBe('boat')
  })
})
