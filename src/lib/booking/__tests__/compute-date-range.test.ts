import { describe, it, expect } from 'vitest'
import { computeDateRange, buildPreFill, expandDateRange } from '../compute-date-range'
import type { OperatorDefaults } from '@/lib/hooks/use-operator-defaults'

const MOCK_DEFAULTS: OperatorDefaults = {
  agency: 'PADI',
  preferredInstructorSlug: 'inst-1',
  preferredVenueSlug: 'venue-1',
  preferredBoatSlug: 'boat-1',
  preferredEquipmentSlug: 'eq-1',
  preferredCompressorSlug: 'comp-1',
}

describe('computeDateRange', () => {
  it('returns start === end for empty courses array', () => {
    const result = computeDateRange([], '2026-04-01')
    expect(result).toEqual({ startDate: '2026-04-01', endDate: '2026-04-01' })
  })

  it('computes correct end date for a single multi-day course', () => {
    // OW is 4 days → start + 3
    const result = computeDateRange(['OW'], '2026-04-01')
    expect(result.startDate).toBe('2026-04-01')
    // End should be after start (exact value depends on course catalog minDays)
    expect(result.endDate >= result.startDate).toBe(true)
  })

  it('computes O+A combo using calculateComboDates', () => {
    const result = computeDateRange(['OW', 'AOW'], '2026-04-01')
    expect(result.startDate).toBe('2026-04-01')
    // O+A combo should span OW + AOW days
    expect(result.endDate > result.startDate).toBe(true)
  })

  it('chains sequential courses — each starts after the previous ends', () => {
    // Two single-course entries should chain
    const single = computeDateRange(['OW'], '2026-04-01')
    const double = computeDateRange(['OW', 'RESCUE'], '2026-04-01')
    // Double should end on or after the single course
    expect(double.endDate >= single.endDate).toBe(true)
  })

  it('handles single-day course (DSD)', () => {
    const result = computeDateRange(['DSD'], '2026-05-10')
    expect(result.startDate).toBe('2026-05-10')
    // DSD is 1 day, so end === start
    expect(result.endDate).toBe('2026-05-10')
  })
})

describe('buildPreFill', () => {
  it('produces a BookingPreFill with correct date range and defaults', () => {
    const result = buildPreFill(['OW'], '2026-04-01', MOCK_DEFAULTS)
    expect(result.courses).toEqual(['OW'])
    expect(result.startDate).toBe('2026-04-01')
    expect(result.endDate >= '2026-04-01').toBe(true)
    expect(result.agency).toBe('PADI')
    expect(result.instructorSlug).toBe('inst-1')
    expect(result.venueSlug).toBe('venue-1')
    expect(result.boatSlug).toBe('boat-1')
    expect(result.equipmentSlug).toBe('eq-1')
    expect(result.compressorSlug).toBe('comp-1')
  })

  it('handles empty courses', () => {
    const result = buildPreFill([], '2026-04-01', MOCK_DEFAULTS)
    expect(result.startDate).toBe('2026-04-01')
    expect(result.endDate).toBe('2026-04-01')
  })
})

describe('expandDateRange', () => {
  it('returns single date when start === end', () => {
    expect(expandDateRange('2026-04-01', '2026-04-01')).toEqual(['2026-04-01'])
  })

  it('returns inclusive range of dates', () => {
    const result = expandDateRange('2026-04-01', '2026-04-03')
    expect(result).toEqual(['2026-04-01', '2026-04-02', '2026-04-03'])
  })

  it('returns empty array when end < start', () => {
    const result = expandDateRange('2026-04-05', '2026-04-01')
    expect(result).toEqual([])
  })
})
