import { describe, it, expect } from 'vitest'
import {
  bookingSessionsSchema,
  makeBookingDiversSchema,
  INSTRUCTOR_REQUIRED_CODES,
  CONFINED_ACTIVITY_CODES,
} from '../src/lib/validation/bookingSchemas'
import { testDate } from './helpers/dates'

describe('INSTRUCTOR_REQUIRED_CODES', () => {
  it('includes DSD and OW', () => {
    expect(INSTRUCTOR_REQUIRED_CODES).toContain('DSD')
    expect(INSTRUCTOR_REQUIRED_CODES).toContain('OW')
  })

  it('does not include FD (fun dive)', () => {
    expect(INSTRUCTOR_REQUIRED_CODES).not.toContain('FD')
  })
})

describe('CONFINED_ACTIVITY_CODES', () => {
  it('includes DSD, TRY_DIVE, OW, REFRESH', () => {
    for (const code of ['DSD', 'TRY_DIVE', 'OW', 'REFRESH']) {
      expect(CONFINED_ACTIVITY_CODES).toContain(code)
    }
  })
})

describe('bookingSessionsSchema', () => {
  const validSession = {
    inventoryUnitId: 'unit-1',
    date: testDate(20),
    startTime: '08:00',
    endTime: '12:00',
    timezone: 'Asia/Bangkok',
    unitsRequested: 1,
  }

  it('accepts a valid session array', () => {
    const result = bookingSessionsSchema.safeParse([validSession])
    expect(result.success).toBe(true)
  })

  it('rejects empty array', () => {
    const result = bookingSessionsSchema.safeParse([])
    expect(result.success).toBe(false)
  })

  it('rejects session with end time before start time', () => {
    const result = bookingSessionsSchema.safeParse([
      { ...validSession, startTime: '14:00', endTime: '08:00' },
    ])
    expect(result.success).toBe(false)
  })

  it('rejects duplicate sessions (same unit + date + startTime)', () => {
    const result = bookingSessionsSchema.safeParse([validSession, validSession])
    expect(result.success).toBe(false)
  })

  it('accepts different sessions on same date', () => {
    const result = bookingSessionsSchema.safeParse([
      validSession,
      { ...validSession, startTime: '14:00', endTime: '18:00' },
    ])
    expect(result.success).toBe(true)
  })

  it('rejects session missing required fields', () => {
    const result = bookingSessionsSchema.safeParse([{ inventoryUnitId: '' }])
    expect(result.success).toBe(false)
  })
})

describe('makeBookingDiversSchema', () => {
  const bookingStart = testDate(10)
  const bookingEnd = testDate(15)
  const bookingActivities = ['OW', 'FD'] as const
  const schema = makeBookingDiversSchema(bookingActivities, bookingStart, bookingEnd)

  const validDiver = {
    name: 'Alice',
    abbrev: 'AL',
    flag: { code: 'US', label: 'United States' },
    startDate: testDate(10),
    endDate: testDate(12),
    activityType: ['OW'],
  }

  it('accepts valid diver array', () => {
    const result = schema.safeParse([validDiver])
    expect(result.success).toBe(true)
  })

  it('rejects empty diver array', () => {
    const result = schema.safeParse([])
    expect(result.success).toBe(false)
  })

  it('rejects diver with end date before start date', () => {
    const result = schema.safeParse([
      { ...validDiver, startDate: testDate(12), endDate: testDate(10) },
    ])
    expect(result.success).toBe(false)
  })

  it('rejects diver start date before booking start', () => {
    const result = schema.safeParse([
      { ...validDiver, startDate: testDate(5) },
    ])
    expect(result.success).toBe(false)
  })

  it('rejects diver end date after booking end', () => {
    const result = schema.safeParse([
      { ...validDiver, endDate: testDate(20) },
    ])
    expect(result.success).toBe(false)
  })

  it('rejects activity type not in booking activities', () => {
    const result = schema.safeParse([
      { ...validDiver, activityType: ['DSD'] },
    ])
    expect(result.success).toBe(false)
  })

  it('rejects diver with empty name', () => {
    const result = schema.safeParse([{ ...validDiver, name: '' }])
    expect(result.success).toBe(false)
  })

  it('rejects abbreviation longer than 4 chars', () => {
    const result = schema.safeParse([{ ...validDiver, abbrev: 'ABCDE' }])
    expect(result.success).toBe(false)
  })
})
