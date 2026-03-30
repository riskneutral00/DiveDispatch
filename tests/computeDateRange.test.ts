import { describe, it, expect } from 'vitest'
import { computeDateRange, buildPreFill } from '../src/lib/booking/compute-date-range'

describe('computeDateRange', () => {
  it('returns startDate = endDate for empty courses', () => {
    const result = computeDateRange([], '2026-03-28')
    expect(result).toEqual({ startDate: '2026-03-28', endDate: '2026-03-28' })
  })

  it('returns correct range for single OW course', () => {
    const result = computeDateRange(['OW'], '2026-03-28')
    expect(result.startDate).toBe('2026-03-28')
    // OW default is 3 days
    expect(result.endDate > result.startDate).toBe(true)
  })

  it('returns correct range for O+A combo', () => {
    const result = computeDateRange(['OW', 'AOW'], '2026-03-28')
    expect(result.startDate).toBe('2026-03-28')
    // O+A combo spans more days than just OW
    const owOnly = computeDateRange(['OW'], '2026-03-28')
    expect(result.endDate >= owOnly.endDate).toBe(true)
  })

  it('chains sequential courses', () => {
    const result = computeDateRange(['DSD'], '2026-03-28')
    expect(result.startDate).toBe('2026-03-28')
    expect(result.endDate).toBeTruthy()
  })

  it('handles FD (fun dives)', () => {
    const result = computeDateRange(['FD'], '2026-03-28')
    expect(result.startDate).toBe('2026-03-28')
  })
})

describe('buildPreFill', () => {
  const defaults = {
    agency: 'PADI' as const,
    preferredInstructorSlug: 'instructor-1',
    preferredVenueSlug: 'pool-1',
    preferredBoatSlug: 'boat-1',
    preferredEquipmentSlug: 'equipment-1',
    preferredCompressorSlug: 'compressor-1',
  }

  it('builds prefill with computed end date', () => {
    const result = buildPreFill(['OW'], '2026-03-28', defaults)
    expect(result.courses).toEqual(['OW'])
    expect(result.startDate).toBe('2026-03-28')
    expect(result.endDate).toBeTruthy()
    expect(result.agency).toBe('PADI')
  })

  it('carries through operator defaults', () => {
    const result = buildPreFill([], '2026-03-28', defaults)
    expect(result.instructorSlug).toBe('instructor-1')
    expect(result.venueSlug).toBe('pool-1')
    expect(result.boatSlug).toBe('boat-1')
    expect(result.equipmentSlug).toBe('equipment-1')
    expect(result.compressorSlug).toBe('compressor-1')
  })

  it('handles empty courses', () => {
    const result = buildPreFill([], '2026-03-28', defaults)
    expect(result.startDate).toBe('2026-03-28')
    expect(result.endDate).toBe('2026-03-28')
  })

  it('handles DSD with prefill defaults', () => {
    const result = buildPreFill(['DSD'], '2026-04-01', defaults)
    expect(result.courses).toEqual(['DSD'])
    expect(result.agency).toBe('PADI')
    expect(result.startDate).toBe('2026-04-01')
  })

  it('handles partial defaults (no preferred slugs)', () => {
    const result = buildPreFill(['FD'], '2026-04-01', {
      agency: 'SSI',
      preferredInstructorSlug: '',
      preferredVenueSlug: '',
      preferredBoatSlug: '',
      preferredEquipmentSlug: '',
      preferredCompressorSlug: '',
    })
    expect(result.agency).toBe('SSI')
    expect(result.instructorSlug).toBe('')
  })
})
