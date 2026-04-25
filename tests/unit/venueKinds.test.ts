import { describe, it, expect } from 'vitest'
import { VENUE_KINDS, RANGE_BY_KIND } from '../../src/lib/constants/venue-subtypes'
import { assertVenueRange } from '../../convex/lib/venueValidators'

describe('VENUE_KINDS membership', () => {
  it('contains exactly pool and dive_site', () => {
    expect([...VENUE_KINDS]).toEqual(['pool', 'dive_site'])
  })
})

describe('RANGE_BY_KIND values', () => {
  it('pool: maxDepth 60, maxCapacity 50', () => {
    expect(RANGE_BY_KIND.pool).toEqual({ maxDepth: 60, maxCapacity: 50 })
  })

  it('dive_site: maxDepth 60, maxCapacity 100', () => {
    expect(RANGE_BY_KIND.dive_site).toEqual({ maxDepth: 60, maxCapacity: 100 })
  })
})

describe('assertVenueRange', () => {
  it('does not throw for valid pool values', () => {
    expect(() => assertVenueRange('pool', 30, 10)).not.toThrow()
  })

  it('throws when pool maxDepth exceeds 60', () => {
    expect(() => assertVenueRange('pool', 70, 10)).toThrow()
  })

  it('throws when dive_site maxDepth is negative', () => {
    expect(() => assertVenueRange('dive_site', -1, 10)).toThrow()
  })
})
