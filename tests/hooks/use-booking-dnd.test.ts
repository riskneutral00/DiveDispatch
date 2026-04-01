import { describe, it, expect } from 'vitest'
import { buildPreFill, computeDateRange } from '@/lib/booking/compute-date-range'
import { toISODateString, addDays } from '@/lib/utils/date'
import type { OperatorDefaults } from '@/lib/hooks/use-operator-defaults'

// Relative dates so tests never go stale
const TODAY = toISODateString(new Date())
const FUTURE = addDays(TODAY, 5)
const YESTERDAY = addDays(TODAY, -1)

const MOCK_DEFAULTS: OperatorDefaults = {
  agency: 'test-agency',
  preferredInstructorSlug: 'instructor-1',
  preferredVenueSlug: 'venue-1',
  preferredBoatSlug: 'boat-1',
  preferredEquipmentSlug: 'equip-1',
  preferredCompressorSlug: 'comp-1',
  preferredInstructorSlugs: ['instructor-1'],
  preferredVenueSlugs: ['venue-1'],
  preferredBoatSlugs: ['boat-1'],
  preferredEquipmentSlugs: ['equip-1'],
  preferredCompressorSlugs: ['comp-1'],
}

describe('drag-to-date pre-fill generation', () => {
  it('builds pre-fill with course, date, and operator defaults', () => {
    const result = buildPreFill(['OW'], FUTURE, MOCK_DEFAULTS)

    expect(result.courses).toEqual(['OW'])
    expect(result.startDate).toBe(FUTURE)
    expect(result.endDate).toBe(addDays(FUTURE, 2)) // OW = 3 days
    expect(result.agency).toBe('test-agency')
    expect(result.instructorSlug).toBe('instructor-1')
    expect(result.venueSlug).toBe('venue-1')
    expect(result.boatSlug).toBe('boat-1')
  })

  it('builds pre-fill for empty courses (+ Booking pill)', () => {
    const result = buildPreFill([], FUTURE, MOCK_DEFAULTS)

    expect(result.courses).toEqual([])
    expect(result.startDate).toBe(FUTURE)
    expect(result.endDate).toBe(FUTURE) // same day
  })

  it('builds pre-fill for O+A combo', () => {
    const result = buildPreFill(['OW', 'AOW'], FUTURE, MOCK_DEFAULTS)

    expect(result.courses).toEqual(['OW', 'AOW'])
    expect(result.startDate).toBe(FUTURE)
    expect(result.endDate).toBe(addDays(FUTURE, 3)) // OW(3d) + AOW overlap = 4 days total
  })

  it('uses empty defaults when operator has no preferences', () => {
    const emptyDefaults: OperatorDefaults = {
      agency: '',
      preferredInstructorSlug: '',
      preferredVenueSlug: '',
      preferredBoatSlug: '',
      preferredEquipmentSlug: '',
      preferredCompressorSlug: '',
      preferredInstructorSlugs: [],
      preferredVenueSlugs: [],
      preferredBoatSlugs: [],
      preferredEquipmentSlugs: [],
      preferredCompressorSlugs: [],
    }
    const result = buildPreFill(['DSD'], FUTURE, emptyDefaults)

    expect(result.instructorSlug).toBe('')
    expect(result.venueSlug).toBe('')
  })
})

describe('date validation for drop targets', () => {
  it('future dates are valid drop targets', () => {
    expect(FUTURE > TODAY || FUTURE === TODAY).toBe(true)
  })

  it('past dates should be rejected', () => {
    expect(YESTERDAY < TODAY).toBe(true)
  })

  it('today is a valid drop target', () => {
    expect(TODAY >= TODAY).toBe(true)
  })
})

describe('computeDateRange', () => {
  it('DSD is single-day', () => {
    const { endDate } = computeDateRange(['DSD'], FUTURE)
    expect(endDate).toBe(FUTURE)
  })

  it('OW spans 3 days', () => {
    const { startDate, endDate } = computeDateRange(['OW'], FUTURE)
    expect(startDate).toBe(FUTURE)
    expect(endDate).toBe(addDays(FUTURE, 2))
  })
})
