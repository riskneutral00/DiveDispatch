import { describe, it, expect } from 'vitest'
import { buildBarSubLabel } from '../build-bar-sub-label'
import type { CalendarBooking } from '../../../../convex/bookings'
import { testDate } from '../../../../tests/helpers/dates'

const FIXTURE_DATE = testDate(5)

function fakeBooking(overrides: Partial<CalendarBooking> = {}): CalendarBooking {
  return {
    _id: 'test-id',
    activityType: ['DSD'],
    startDate: FIXTURE_DATE,
    endDate: FIXTURE_DATE,
    status: 'Upcoming',
    diverCount: 1,
    instructorName: undefined,
    boatName: undefined,
    customerName: undefined,
    operatorName: 'Nicole Dive Center',
    reservationStatus: undefined,
    resources: [],
    ...overrides,
  }
}

describe('buildBarSubLabel', () => {
  it('Instructor view: shortens operator name with "Dive Center"', () => {
    const b = fakeBooking({ instructorName: 'Ryan Clarke', operatorName: 'Nicole Dive Center' })
    expect(buildBarSubLabel(b, 'Instructor')).toBe('Nicole DC')
  })

  it('Instructor view: returns single-word operator name unchanged', () => {
    const b = fakeBooking({ instructorName: 'Ryan Clarke', operatorName: 'Amanda' })
    expect(buildBarSubLabel(b, 'Instructor')).toBe('Amanda')
  })

  it('Instructor view: shows operator even when instructorName is undefined', () => {
    const b = fakeBooking({ instructorName: undefined, operatorName: 'Nicole Dive Center' })
    expect(buildBarSubLabel(b, 'Instructor')).toBe('Nicole DC')
  })

  it('DiveCenter view: returns instructor first name', () => {
    const b = fakeBooking({ instructorName: 'Ryan Clarke', operatorName: 'Nicole Dive Center' })
    expect(buildBarSubLabel(b, 'DiveCenter')).toBe('Ryan')
  })

  it('Agent view: returns instructor first name', () => {
    const b = fakeBooking({ instructorName: 'Nattaya Srisuk', operatorName: 'Amanda' })
    expect(buildBarSubLabel(b, 'Agent')).toBe('Nattaya')
  })

  it('undefined role: returns instructor first name', () => {
    const b = fakeBooking({ instructorName: 'Ryan Clarke', operatorName: 'Nicole Dive Center' })
    expect(buildBarSubLabel(b, undefined)).toBe('Ryan')
  })

  it('non-Instructor view with no instructorName: returns undefined', () => {
    const b = fakeBooking({ instructorName: undefined, operatorName: 'Nicole Dive Center' })
    expect(buildBarSubLabel(b, 'DiveCenter')).toBeUndefined()
  })

  it('returns first name only when instructor has single name', () => {
    const b = fakeBooking({ instructorName: 'Tanaka', operatorName: 'Nicole Dive Center' })
    expect(buildBarSubLabel(b, 'DiveCenter')).toBe('Tanaka')
  })

  it('Instructor view: Coral Dive Resort with instructor set still shows shortened operator', () => {
    const b = fakeBooking({
      operatorName: 'Coral Dive Resort',
      instructorName: 'John Smith',
    })
    expect(buildBarSubLabel(b, 'Instructor')).toBe('Coral DR')
  })
})
