import { describe, it, expect } from 'vitest'
import {
  checkPreferenceCoverage,
  type CoverageInput,
  type VenueCapabilities,
  type BoatCapabilities,
} from '../coverage-validation'

// ── Helpers ──────────────────────────────────────────────────────────

function makeInput(overrides: Partial<CoverageInput> = {}): CoverageInput {
  return {
    preferredInstructorSlugs: [],
    preferredEquipmentSlugs: [],
    preferredVenueSlugs: [],
    preferredBoatSlugs: [],
    preferredCompressorSlugs: [],
    venueCapabilities: {},
    boatCapabilities: {},
    ...overrides,
  }
}

function pool(caps: Partial<Omit<VenueCapabilities, 'venueType'>> = {}): VenueCapabilities {
  return {
    venueType: 'Pool',
    confinedCapable: false,
    hasCompressor: false,
    ...caps,
  }
}

function diveSite(caps: Partial<Omit<VenueCapabilities, 'venueType'>> = {}): VenueCapabilities {
  return {
    venueType: 'Shore',
    confinedCapable: false,
    hasCompressor: false,
    ...caps,
  }
}

function boat(caps: Partial<BoatCapabilities> = {}): BoatCapabilities {
  return {
    hasCompressor: false,
    ...caps,
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('checkPreferenceCoverage', () => {
  // ── Empty / Missing ──────────────────────────────────────────────

  it('fails with all 5 requirements unmet when no preferences exist', () => {
    const result = checkPreferenceCoverage(makeInput())
    expect(result.isComplete).toBe(false)
    expect(result.missing).toHaveLength(5)
    expect(result.missing).toContain('instructor')
    expect(result.missing).toContain('equipmentManager')
    expect(result.missing).toContain('confinedWater')
    expect(result.missing).toContain('openWater')
    expect(result.missing).toContain('compressor')
  })

  it('fails when only instructor is set', () => {
    const result = checkPreferenceCoverage(
      makeInput({ preferredInstructorSlugs: ['inst-1'] }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).not.toContain('instructor')
    expect(result.missing).toContain('equipmentManager')
    expect(result.missing).toContain('confinedWater')
    expect(result.missing).toContain('openWater')
    expect(result.missing).toContain('compressor')
  })

  it('fails when instructor + equipment set but no venues or compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).not.toContain('instructor')
    expect(result.missing).not.toContain('equipmentManager')
    expect(result.missing).toContain('confinedWater')
    expect(result.missing).toContain('openWater')
    expect(result.missing).toContain('compressor')
  })

  // ── Pool Coverage ──────────────────────────────────────────────

  it('confined-capable pool satisfies both confined and open water', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredVenueSlugs: ['pool-1'],
        venueCapabilities: {
          'pool-1': pool({ confinedCapable: true }),
        },
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).not.toContain('confinedWater')
    expect(result.missing).not.toContain('openWater')
    expect(result.missing).toContain('compressor')
  })

  it('non-confined pool satisfies neither confined nor open water', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredVenueSlugs: ['pool-1'],
        venueCapabilities: {
          'pool-1': pool({ confinedCapable: false }),
        },
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('confinedWater')
    expect(result.missing).toContain('openWater')
  })

  // ── Dive Site Coverage ─────────────────────────────────────────

  it('dive site satisfies open water but not confined', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredVenueSlugs: ['reef-1'],
        venueCapabilities: {
          'reef-1': diveSite(),
        },
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('confinedWater')
    expect(result.missing).toContain('compressor')
    expect(result.missing).not.toContain('openWater')
  })

  // ── Full Coverage ──────────────────────────────────────────────

  it('passes when confined pool also has compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredVenueSlugs: ['pool-1'],
        venueCapabilities: {
          'pool-1': pool({ confinedCapable: true, hasCompressor: true }),
        },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  // ── Boat Satisfies All Venue Needs ─────────────────────────────

  it('passes when boat with compressor covers all venue + compressor needs', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredBoatSlugs: ['boat-1'],
        boatCapabilities: {
          'boat-1': boat({ hasCompressor: true }),
        },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('passes when boat without compressor + standalone compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredBoatSlugs: ['boat-1'],
        preferredCompressorSlugs: ['comp-1'],
        boatCapabilities: {
          'boat-1': boat(),
        },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('fails when boat without compressor and no standalone compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredBoatSlugs: ['boat-1'],
        boatCapabilities: {
          'boat-1': boat(),
        },
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toEqual(['compressor'])
  })

  // ── Mixed Venue + Boat Coverage ────────────────────────────────

  it('passes with confined pool + boat + compressor on pool', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredVenueSlugs: ['pool-1'],
        preferredBoatSlugs: ['boat-1'],
        venueCapabilities: {
          'pool-1': pool({ confinedCapable: true, hasCompressor: true }),
        },
        boatCapabilities: {
          'boat-1': boat(),
        },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('passes with confined pool + dive site + standalone compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredVenueSlugs: ['pool-1', 'reef-1'],
        preferredCompressorSlugs: ['comp-1'],
        venueCapabilities: {
          'pool-1': pool({ confinedCapable: true }),
          'reef-1': diveSite(),
        },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('passes with boat (no compressor) + venue that has compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredBoatSlugs: ['boat-1'],
        preferredVenueSlugs: ['shop-1'],
        boatCapabilities: {
          'boat-1': boat(),
        },
        venueCapabilities: {
          'shop-1': pool({ hasCompressor: true }),
        },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  // ── Edge Cases ─────────────────────────────────────────────────

  it('ignores venue slugs that have no matching capability data', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredVenueSlugs: ['ghost-venue'],
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('confinedWater')
    expect(result.missing).toContain('openWater')
    expect(result.missing).toContain('compressor')
  })

  it('handles multiple venues that collectively cover all needs', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredVenueSlugs: ['pool-1', 'shop-1'],
        venueCapabilities: {
          'pool-1': pool({ confinedCapable: true }),
          'shop-1': pool({ hasCompressor: true }),
        },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })
})
