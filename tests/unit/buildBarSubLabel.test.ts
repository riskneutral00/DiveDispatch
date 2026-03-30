import { describe, it, expect } from 'vitest'
import { buildBarSubLabel } from '../../src/lib/utils/build-bar-sub-label'

import type { CalendarBooking } from '../../convex/bookings'

const booking = (overrides: Partial<CalendarBooking> = {}): CalendarBooking => ({
  _id: 'b1',
  status: 'Draft',
  activityType: ['OW'],
  startDate: '2026-04-01',
  endDate: '2026-04-03',
  operatorName: 'Siam Dive Center',
  instructorName: 'Jane Smith',
  boatName: undefined,
  customerName: undefined,
  reservationStatus: undefined,
  resources: [],
  diverCount: 1,
  ...overrides,
})

describe('buildBarSubLabel', () => {
  it('returns shortened operator name for Instructor viewer', () => {
    expect(buildBarSubLabel(booking(), 'Instructor')).toBe('Siam DC')
  })

  it('returns instructor first name for non-Instructor viewer', () => {
    expect(buildBarSubLabel(booking(), 'DiveCenter')).toBe('Jane')
  })

  it('returns undefined when no instructor name and not Instructor viewer', () => {
    expect(buildBarSubLabel(booking({ instructorName: undefined }), 'DiveCenter')).toBeUndefined()
  })

  it('returns instructor first name when viewerRole is undefined', () => {
    expect(buildBarSubLabel(booking())).toBe('Jane')
  })

  it('handles operator names without "Dive Center" keyword', () => {
    expect(buildBarSubLabel(booking({ operatorName: 'Blue Planet' }), 'Instructor')).toBe('Blue Planet')
  })
})
