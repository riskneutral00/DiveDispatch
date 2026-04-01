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

/** Fully-covered input so tests can selectively remove pieces. */
function fullCoverage(overrides?: Partial<CoverageInput>): CoverageInput {
  return {
    preferredInstructorSlugs: ['instructor-a'],
    preferredEquipmentSlugs: ['em-a'],
    preferredVenueSlugs: ['pool-a', 'site-a'],
    preferredBoatSlugs: [],
    preferredCompressorSlugs: ['comp-a'],
    venueCapabilities: {
      'pool-a': { venueType: 'Pool', confinedCapable: true, hasCompressor: false },
      'site-a': { venueType: 'DiveSite', confinedCapable: false, hasCompressor: false },
    },
    boatCapabilities: {},
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('checkPreferenceCoverage', () => {
  it('returns complete when all five requirements are met', () => {
    const result = checkPreferenceCoverage(fullCoverage())
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
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

  // ── Missing individual requirements ───────────────────────────────

  it('reports missing instructor when none preferred', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({ preferredInstructorSlugs: [] }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('instructor')
  })

  it('reports missing equipment manager when none preferred', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({ preferredEquipmentSlugs: [] }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('equipmentManager')
  })

  it('reports missing compressor when no compressor source exists', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({ preferredCompressorSlugs: [] }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('compressor')
  })

  it('reports missing confined water with only a dive site', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredVenueSlugs: ['site-a'],
        venueCapabilities: {
          'site-a': { venueType: 'DiveSite', confinedCapable: false, hasCompressor: false },
        },
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('confinedWater')
  })

  it('reports missing open water with only a non-confined pool', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredVenueSlugs: ['pool-only'],
        venueCapabilities: {
          'pool-only': { venueType: 'Pool', confinedCapable: false, hasCompressor: false },
        },
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('openWater')
  })

  // ── All missing ──────────────────────────────────────────────────

  it('reports all five missing when input is completely empty', () => {
    const result = checkPreferenceCoverage({
      preferredInstructorSlugs: [],
      preferredEquipmentSlugs: [],
      preferredVenueSlugs: [],
      preferredBoatSlugs: [],
      preferredCompressorSlugs: [],
      venueCapabilities: {},
      boatCapabilities: {},
    })
    expect(result.isComplete).toBe(false)
    expect(result.missing).toEqual([
      'instructor',
      'equipmentManager',
      'confinedWater',
      'openWater',
      'compressor',
    ])
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

  // ── Boat satisfies venue and compressor needs ────────────────────

  it('boat satisfies both confined and open water needs', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredVenueSlugs: [],
        venueCapabilities: {},
        preferredBoatSlugs: ['boat-a'],
        boatCapabilities: { 'boat-a': { hasCompressor: true } },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('boat with compressor satisfies compressor requirement', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredCompressorSlugs: [],
        preferredBoatSlugs: ['boat-a'],
        boatCapabilities: { 'boat-a': { hasCompressor: true } },
      }),
    )
    expect(result.isComplete).toBe(true)
  })

  it('boat without compressor does not satisfy compressor requirement', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredCompressorSlugs: [],
        preferredBoatSlugs: ['boat-a'],
        boatCapabilities: { 'boat-a': { hasCompressor: false } },
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('compressor')
  })

  // ── Venue bundled compressor ──────────────────────────────────────

  it('venue with hasCompressor satisfies compressor requirement', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredCompressorSlugs: [],
        venueCapabilities: {
          'pool-a': { venueType: 'Pool', confinedCapable: true, hasCompressor: true },
          'site-a': { venueType: 'DiveSite', confinedCapable: false, hasCompressor: false },
        },
      }),
    )
    expect(result.isComplete).toBe(true)
  })

  // ── Confined-capable pool satisfies both venue needs ─────────────

  it('confined-capable pool satisfies both confined and open water', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredVenueSlugs: ['pool-a'],
        venueCapabilities: {
          'pool-a': { venueType: 'Pool', confinedCapable: true, hasCompressor: false },
        },
      }),
    )
    expect(result.missing).not.toContain('confinedWater')
    expect(result.missing).not.toContain('openWater')
  })

  it('confined-capable pool with instructor + EM leaves only compressor missing', () => {
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

  // ── Unknown venue slug is ignored ────────────────────────────────

  it('ignores venue slugs not in venueCapabilities', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredVenueSlugs: ['unknown-venue'],
        venueCapabilities: {},
      }),
    )
    expect(result.missing).toContain('confinedWater')
    expect(result.missing).toContain('openWater')
  })

  // ── Unknown boat slug is ignored ─────────────────────────────────

  it('ignores boat slugs not in boatCapabilities', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredCompressorSlugs: [],
        preferredBoatSlugs: ['unknown-boat'],
        boatCapabilities: {},
      }),
    )
    expect(result.missing).toContain('compressor')
  })

  // ── Non-confined Pool ───────────────────────────────────────────

  it('non-confined Pool does not satisfy confinedWater', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredVenueSlugs: ['pool-1'],
        venueCapabilities: {
          'pool-1': { venueType: 'Pool', confinedCapable: false, hasCompressor: false },
        },
      }),
    )
    expect(result.missing).toContain('confinedWater')
  })

  it('non-confined pool satisfies neither confined nor open water when it is the only venue', () => {
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

  // ── DiveSite / non-Pool satisfies openWater only ────────────────

  it('non-Pool venue (DiveSite) satisfies openWater but not confinedWater', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredVenueSlugs: ['site-1'],
        venueCapabilities: {
          'site-1': { venueType: 'DiveSite', confinedCapable: false, hasCompressor: false },
        },
      }),
    )
    expect(result.missing).not.toContain('openWater')
    expect(result.missing).toContain('confinedWater')
  })

  it('dive site (Shore) satisfies open water but not confined', () => {
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

  // ── Combined partial scenarios ──────────────────────────────────

  it('instructor + EM only leaves venues and compressor missing', () => {
    const result = checkPreferenceCoverage({
      preferredInstructorSlugs: ['inst-1'],
      preferredEquipmentSlugs: ['em-1'],
      preferredVenueSlugs: [],
      preferredBoatSlugs: [],
      preferredCompressorSlugs: [],
      venueCapabilities: {},
      boatCapabilities: {},
    })
    expect(result.isComplete).toBe(false)
    expect(result.missing).toEqual(['confinedWater', 'openWater', 'compressor'])
  })

  it('everything except compressor is incomplete', () => {
    const result = checkPreferenceCoverage({
      preferredInstructorSlugs: ['inst-1'],
      preferredEquipmentSlugs: ['em-1'],
      preferredVenueSlugs: [],
      preferredBoatSlugs: ['boat-1'],
      preferredCompressorSlugs: [],
      venueCapabilities: {},
      boatCapabilities: { 'boat-1': { hasCompressor: false } },
    })
    expect(result.isComplete).toBe(false)
    expect(result.missing).toEqual(['compressor'])
  })

  it('multiple boats — one with compressor is enough', () => {
    const result = checkPreferenceCoverage({
      preferredInstructorSlugs: ['inst-1'],
      preferredEquipmentSlugs: ['em-1'],
      preferredVenueSlugs: [],
      preferredBoatSlugs: ['boat-1', 'boat-2'],
      preferredCompressorSlugs: [],
      venueCapabilities: {},
      boatCapabilities: {
        'boat-1': { hasCompressor: false },
        'boat-2': { hasCompressor: true },
      },
    })
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('multiple venues with combined capabilities satisfy all venue needs', () => {
    const result = checkPreferenceCoverage({
      preferredInstructorSlugs: ['inst-1'],
      preferredEquipmentSlugs: ['em-1'],
      preferredVenueSlugs: ['pool-1', 'site-1'],
      preferredBoatSlugs: [],
      preferredCompressorSlugs: ['comp-1'],
      venueCapabilities: {
        'pool-1': { venueType: 'Pool', confinedCapable: true, hasCompressor: false },
        'site-1': { venueType: 'DiveSite', confinedCapable: false, hasCompressor: false },
      },
      boatCapabilities: {},
    })
    expect(result.isComplete).toBe(true)
  })

  // ── Standalone compressor slug ──────────────────────────────────

  it('standalone compressor slug satisfies compressor', () => {
    const result = checkPreferenceCoverage({
      preferredInstructorSlugs: [],
      preferredEquipmentSlugs: [],
      preferredVenueSlugs: [],
      preferredBoatSlugs: [],
      preferredCompressorSlugs: ['comp-1'],
      venueCapabilities: {},
      boatCapabilities: {},
    })
    expect(result.missing).not.toContain('compressor')
  })

  // ── Full pass variants (makeInput) ───────────────────────────────

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
})
