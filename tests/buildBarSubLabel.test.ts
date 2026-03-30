import { describe, it, expect } from 'vitest'
import { buildBarSubLabel } from '../src/lib/utils/build-bar-sub-label'
import type { CalendarBooking } from '../convex/bookings'

function makeBooking(overrides: Partial<CalendarBooking> = {}): CalendarBooking {
  return {
    _id: 'test-booking',
    activityType: ['OW'],
    startDate: '2026-03-28',
    endDate: '2026-03-30',
    status: 'Upcoming',
    diverCount: 1,
    instructorName: undefined,
    boatName: undefined,
    customerName: undefined,
    operatorName: 'Blue Ocean Dive Center',
    reservationStatus: undefined,
    resources: [],
    ...overrides,
  }
}

describe('buildBarSubLabel', () => {
  it('returns shortened operator name for Instructor viewer', () => {
    const booking = makeBooking({ operatorName: 'Blue Ocean Dive Center' })
    expect(buildBarSubLabel(booking, 'Instructor')).toBe('Blue Ocean DC')
  })

  it('returns instructor first name for non-Instructor viewer', () => {
    const booking = makeBooking({ instructorName: 'John Smith' })
    expect(buildBarSubLabel(booking, 'DiveCenter')).toBe('John')
  })

  it('returns undefined when no instructor name and not Instructor viewer', () => {
    const booking = makeBooking({ instructorName: undefined })
    expect(buildBarSubLabel(booking, 'DiveCenter')).toBeUndefined()
  })

  it('returns undefined when no viewer role and no instructor name', () => {
    const booking = makeBooking({ instructorName: undefined })
    expect(buildBarSubLabel(booking)).toBeUndefined()
  })

  it('returns first name only when instructor has single name', () => {
    const booking = makeBooking({ instructorName: 'Tanaka' })
    expect(buildBarSubLabel(booking, 'DiveCenter')).toBe('Tanaka')
  })

  it('returns operator name for Instructor even when instructor name exists', () => {
    const booking = makeBooking({
      operatorName: 'Coral Dive Resort',
      instructorName: 'John Smith',
    })
    expect(buildBarSubLabel(booking, 'Instructor')).toBe('Coral DR')
  })
})
