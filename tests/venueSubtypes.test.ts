import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  VENUE_SUBTYPES,
  RANGE_BY_SUBTYPE,
  SUBTYPES_WITH_OPTIONAL_CONFINED,
  CAPABILITIES_REQUIRED_BY_SUBTYPE,
  RECOMMENDED_BY_SUBTYPE,
  isVenueConfinedCapable,
  type VenueSubtype,
} from '../convex/shared/venueTypes'
import {
  assertCapabilitiesPresentForSubtype,
  assertVenueRange,
  assertVenueSubtypeConsistent,
} from '../convex/lib/venueValidators'

describe('VENUE_SUBTYPES enum', () => {
  it('contains the seven agreed subtypes', () => {
    expect(new Set(VENUE_SUBTYPES)).toEqual(
      new Set(['pool', 'shore', 'reef', 'lake', 'river', 'quarry', 'other']),
    )
  })
})

describe('RANGE_BY_SUBTYPE', () => {
  it('covers every subtype', () => {
    for (const subtype of VENUE_SUBTYPES) {
      expect(RANGE_BY_SUBTYPE[subtype]).toBeDefined()
      expect(RANGE_BY_SUBTYPE[subtype].maxDepth).toBeGreaterThan(0)
      expect(RANGE_BY_SUBTYPE[subtype].maxCapacity).toBeGreaterThan(0)
    }
  })

  it('pool depth caps at 60m and capacity at 50', () => {
    expect(RANGE_BY_SUBTYPE.pool).toEqual({ maxDepth: 60, maxCapacity: 50 })
  })

  it('reef depth caps at 40m', () => {
    expect(RANGE_BY_SUBTYPE.reef.maxDepth).toBe(40)
  })

  it('other has the loosest range (60m / 100)', () => {
    expect(RANGE_BY_SUBTYPE.other).toEqual({ maxDepth: 60, maxCapacity: 100 })
  })
})

describe('isVenueConfinedCapable', () => {
  it('returns true for pool regardless of confinedCapable flag', () => {
    expect(isVenueConfinedCapable({ subtype: 'pool' })).toBe(true)
    expect(isVenueConfinedCapable({ subtype: 'pool', confinedCapable: false })).toBe(true)
  })

  it('returns true for shore only when flag is true', () => {
    expect(isVenueConfinedCapable({ subtype: 'shore', confinedCapable: true })).toBe(true)
    expect(isVenueConfinedCapable({ subtype: 'shore', confinedCapable: false })).toBe(false)
    expect(isVenueConfinedCapable({ subtype: 'shore' })).toBe(false)
  })

  it('returns true for other only when flag is true', () => {
    expect(isVenueConfinedCapable({ subtype: 'other', confinedCapable: true })).toBe(true)
    expect(isVenueConfinedCapable({ subtype: 'other' })).toBe(false)
  })

  it('returns false for reef/lake/river/quarry regardless of flag', () => {
    const nonConfinedSubtypes: VenueSubtype[] = ['reef', 'lake', 'river', 'quarry']
    for (const subtype of nonConfinedSubtypes) {
      expect(isVenueConfinedCapable({ subtype })).toBe(false)
      expect(isVenueConfinedCapable({ subtype, confinedCapable: true })).toBe(false)
    }
  })
})

describe('SUBTYPES_WITH_OPTIONAL_CONFINED', () => {
  it('contains exactly shore and other', () => {
    expect(SUBTYPES_WITH_OPTIONAL_CONFINED).toEqual(new Set(['shore', 'other']))
  })
})

describe('assertVenueRange', () => {
  it('passes when values are within subtype caps', () => {
    expect(() => assertVenueRange('pool', 3, 20)).not.toThrow()
    expect(() => assertVenueRange('reef', 35, 25)).not.toThrow()
    expect(() => assertVenueRange('other', 60, 100)).not.toThrow()
  })

  it('passes when values are undefined', () => {
    expect(() => assertVenueRange('pool')).not.toThrow()
    expect(() => assertVenueRange('pool', undefined, 20)).not.toThrow()
    expect(() => assertVenueRange('pool', 3, undefined)).not.toThrow()
  })

  it('throws VALIDATION when maxDepth exceeds subtype cap', () => {
    let caught: ConvexError<{ code: string; reason: string }> | null = null
    try {
      assertVenueRange('pool', 61)
    } catch (err) {
      caught = err as ConvexError<{ code: string; reason: string }>
    }
    expect(caught).not.toBeNull()
    expect(caught!.data.code).toBe('VALIDATION')
    expect(caught!.data.reason).toContain('max_depth_exceeds_subtype_cap')
  })

  it('throws VALIDATION when maxCapacity exceeds subtype cap', () => {
    let caught: ConvexError<{ code: string; reason: string }> | null = null
    try {
      assertVenueRange('pool', undefined, 51)
    } catch (err) {
      caught = err as ConvexError<{ code: string; reason: string }>
    }
    expect(caught).not.toBeNull()
    expect(caught!.data.code).toBe('VALIDATION')
    expect(caught!.data.reason).toContain('max_capacity_exceeds_subtype_cap')
  })

  it('throws on negative or NaN values', () => {
    expect(() => assertVenueRange('pool', -1)).toThrow(ConvexError)
    expect(() => assertVenueRange('pool', NaN)).toThrow(ConvexError)
    expect(() => assertVenueRange('pool', 3, -5)).toThrow(ConvexError)
  })
})

describe('CAPABILITIES_REQUIRED_BY_SUBTYPE', () => {
  it('requires caps for pool only', () => {
    expect(CAPABILITIES_REQUIRED_BY_SUBTYPE.has('pool')).toBe(true)
    const nonPool: VenueSubtype[] = ['shore', 'reef', 'lake', 'river', 'quarry', 'other']
    for (const subtype of nonPool) {
      expect(CAPABILITIES_REQUIRED_BY_SUBTYPE.has(subtype)).toBe(false)
    }
  })
})

describe('RECOMMENDED_BY_SUBTYPE', () => {
  it('offers pool recommended values 2.5m / 5', () => {
    expect(RECOMMENDED_BY_SUBTYPE.pool).toEqual({ maxDepth: 2.5, maxCapacity: 5 })
  })

  it('has no recommendation for non-pool subtypes', () => {
    const nonPool: VenueSubtype[] = ['shore', 'reef', 'lake', 'river', 'quarry', 'other']
    for (const subtype of nonPool) {
      expect(RECOMMENDED_BY_SUBTYPE[subtype]).toBeUndefined()
    }
  })
})

describe('assertCapabilitiesPresentForSubtype', () => {
  it('passes when pool has both maxDepth and maxCapacity', () => {
    expect(() => assertCapabilitiesPresentForSubtype('pool', 2.5, 5)).not.toThrow()
  })

  it('throws VALIDATION when pool lacks maxDepth', () => {
    let caught: ConvexError<{ code: string; reason: string }> | null = null
    try {
      assertCapabilitiesPresentForSubtype('pool', undefined, 5)
    } catch (err) {
      caught = err as ConvexError<{ code: string; reason: string }>
    }
    expect(caught).not.toBeNull()
    expect(caught!.data.code).toBe('VALIDATION')
    expect(caught!.data.reason).toBe('capabilities_required_for_subtype:pool')
  })

  it('throws VALIDATION when pool lacks maxCapacity', () => {
    expect(() => assertCapabilitiesPresentForSubtype('pool', 2.5, undefined)).toThrow(ConvexError)
  })

  it('throws VALIDATION when pool lacks both', () => {
    expect(() => assertCapabilitiesPresentForSubtype('pool', undefined, undefined)).toThrow(ConvexError)
  })

  it('passes for non-pool subtypes regardless of caps', () => {
    const nonPool: VenueSubtype[] = ['shore', 'reef', 'lake', 'river', 'quarry', 'other']
    for (const subtype of nonPool) {
      expect(() => assertCapabilitiesPresentForSubtype(subtype, undefined, undefined)).not.toThrow()
      expect(() => assertCapabilitiesPresentForSubtype(subtype, 10, 20)).not.toThrow()
    }
  })
})

describe('assertVenueSubtypeConsistent', () => {
  it('allows confinedCapable=true on shore and other', () => {
    expect(() => assertVenueSubtypeConsistent('shore', true)).not.toThrow()
    expect(() => assertVenueSubtypeConsistent('other', true)).not.toThrow()
  })

  it('allows confinedCapable=true on pool (implicit, but not rejected)', () => {
    expect(() => assertVenueSubtypeConsistent('pool', true)).not.toThrow()
  })

  it('rejects confinedCapable=true on reef/lake/river/quarry', () => {
    const rejected: VenueSubtype[] = ['reef', 'lake', 'river', 'quarry']
    for (const subtype of rejected) {
      let caught: ConvexError<{ code: string; reason: string }> | null = null
      try {
        assertVenueSubtypeConsistent(subtype, true)
      } catch (err) {
        caught = err as ConvexError<{ code: string; reason: string }>
      }
      expect(caught).not.toBeNull()
      expect(caught!.data.code).toBe('VALIDATION')
      expect(caught!.data.reason).toContain(`confined_capable_invalid_for_subtype:${subtype}`)
    }
  })

  it('allows confinedCapable=false or undefined on any subtype', () => {
    for (const subtype of VENUE_SUBTYPES) {
      expect(() => assertVenueSubtypeConsistent(subtype, false)).not.toThrow()
      expect(() => assertVenueSubtypeConsistent(subtype, undefined)).not.toThrow()
    }
  })
})
