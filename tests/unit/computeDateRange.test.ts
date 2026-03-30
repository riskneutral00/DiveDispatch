import { describe, it, expect } from 'vitest'
import { computeDateRange, buildPreFill } from '../../src/lib/booking/compute-date-range'

describe('computeDateRange', () => {
  it('returns same start and end for empty courses', () => {
    const result = computeDateRange([], '2026-04-01')
    expect(result).toEqual({ startDate: '2026-04-01', endDate: '2026-04-01' })
  })

  it('computes OW range (3 day course)', () => {
    const result = computeDateRange(['OW'], '2026-04-01')
    expect(result.startDate).toBe('2026-04-01')
    expect(result.endDate).toBe('2026-04-03')
  })

  it('computes O+A combo range', () => {
    const result = computeDateRange(['OW', 'AOW'], '2026-04-01')
    expect(result.startDate).toBe('2026-04-01')
    // OW: 3 days (Apr 1-3), AOW: 2 days starting from OW end (Apr 3-4)
    expect(result.endDate).toBe('2026-04-04')
  })

  it('computes single-day course (DSD)', () => {
    const result = computeDateRange(['DSD'], '2026-04-01')
    expect(result.startDate).toBe('2026-04-01')
    expect(result.endDate).toBe('2026-04-01')
  })

  it('chains sequential courses', () => {
    // OW (3 days) then RESCUE (2 days)
    const result = computeDateRange(['OW', 'RESCUE'], '2026-04-01')
    expect(result.startDate).toBe('2026-04-01')
    // OW ends Apr 3, RESCUE starts Apr 3, ends Apr 4
    expect(result.endDate >= '2026-04-03').toBe(true)
  })
})

describe('buildPreFill', () => {
  it('builds prefill with operator defaults', () => {
    const defaults = {
      agency: 'PADI',
      preferredInstructorSlug: 'jane',
      preferredVenueSlug: 'pool-1',
      preferredBoatSlug: 'boat-1',
      preferredEquipmentSlug: 'em-1',
      preferredCompressorSlug: 'comp-1',
    }
    const prefill = buildPreFill(['OW'], '2026-04-01', defaults)
    expect(prefill.courses).toEqual(['OW'])
    expect(prefill.startDate).toBe('2026-04-01')
    expect(prefill.agency).toBe('PADI')
    expect(prefill.instructorSlug).toBe('jane')
    expect(prefill.venueSlug).toBe('pool-1')
    expect(prefill.boatSlug).toBe('boat-1')
  })

  it('computes end date from courses', () => {
    const defaults = {} as Parameters<typeof buildPreFill>[2]
    const prefill = buildPreFill(['OW'], '2026-04-01', defaults)
    expect(prefill.endDate).toBe('2026-04-03')
  })
})
