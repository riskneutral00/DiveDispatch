import { describe, it, expect } from 'vitest'
import {
  LEGACY_VENUE_TYPE_TO_CATEGORY,
  LEGACY_VENUE_TYPE_TO_DIVE_SITE_TYPES,
  VENUE_TYPES,
  DIVE_SITE_TYPES,
  VENUE_CATEGORIES,
  type VenueType,
} from '../convex/shared/venueTypes'

describe('LEGACY_VENUE_TYPE_TO_CATEGORY', () => {
  it('maps Pool to pool category', () => {
    expect(LEGACY_VENUE_TYPE_TO_CATEGORY.Pool).toBe('pool')
  })

  it('maps every non-Pool legacy type to diveSite category', () => {
    const nonPool = VENUE_TYPES.filter((v) => v !== 'Pool')
    for (const legacy of nonPool) {
      expect(LEGACY_VENUE_TYPE_TO_CATEGORY[legacy as VenueType]).toBe('diveSite')
    }
  })

  it('covers every legacy VENUE_TYPES member (no missing keys)', () => {
    const keys = Object.keys(LEGACY_VENUE_TYPE_TO_CATEGORY)
    expect(new Set(keys)).toEqual(new Set(VENUE_TYPES))
  })
})

describe('LEGACY_VENUE_TYPE_TO_DIVE_SITE_TYPES', () => {
  it('maps Shore to [shore]', () => {
    expect(LEGACY_VENUE_TYPE_TO_DIVE_SITE_TYPES.Shore).toEqual(['shore'])
  })

  it('maps Reef to [reef]', () => {
    expect(LEGACY_VENUE_TYPE_TO_DIVE_SITE_TYPES.Reef).toEqual(['reef'])
  })

  it('maps Lake to [other] (no native lake subtype in new enum)', () => {
    expect(LEGACY_VENUE_TYPE_TO_DIVE_SITE_TYPES.Lake).toEqual(['other'])
  })

  it('maps River to [river]', () => {
    expect(LEGACY_VENUE_TYPE_TO_DIVE_SITE_TYPES.River).toEqual(['river'])
  })

  it('maps Quarry to [quarry]', () => {
    expect(LEGACY_VENUE_TYPE_TO_DIVE_SITE_TYPES.Quarry).toEqual(['quarry'])
  })

  it('maps Other to [other]', () => {
    expect(LEGACY_VENUE_TYPE_TO_DIVE_SITE_TYPES.Other).toEqual(['other'])
  })

  it('maps Pool to empty array (Pool is a separate category)', () => {
    expect(LEGACY_VENUE_TYPE_TO_DIVE_SITE_TYPES.Pool).toEqual([])
  })

  it('every mapped subtype is a valid DiveSiteType', () => {
    for (const subtypes of Object.values(LEGACY_VENUE_TYPE_TO_DIVE_SITE_TYPES)) {
      for (const s of subtypes) {
        expect(DIVE_SITE_TYPES as readonly string[]).toContain(s)
      }
    }
  })
})

describe('VENUE_CATEGORIES enum', () => {
  it('contains exactly pool + diveSite', () => {
    expect(new Set(VENUE_CATEGORIES)).toEqual(new Set(['pool', 'diveSite']))
  })
})

describe('DIVE_SITE_TYPES enum', () => {
  it('contains the six agreed subtypes and no Pool', () => {
    expect(new Set(DIVE_SITE_TYPES)).toEqual(
      new Set(['shore', 'reef', 'lake', 'river', 'quarry', 'other']),
    )
  })
})
