import { describe, it, expect } from 'vitest'
import {
  checkPreferenceCoverage,
  type CoverageInput,
} from '../../convex/shared/coverageValidation'

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

// ── All missing ────────────────────────────────────────────────────────────────

describe('checkPreferenceCoverage — empty input', () => {
  it('returns all 5 missing categories when nothing is provided', () => {
    const result = checkPreferenceCoverage(makeInput())
    expect(result.isComplete).toBe(false)
    expect(result.missing).toEqual([
      'instructor',
      'equipmentManager',
      'confinedWater',
      'openWater',
      'compressor',
    ])
  })
})

// ── Complete coverage ──────────────────────────────────────────────────────────

describe('checkPreferenceCoverage — complete coverage', () => {
  it('returns isComplete with boat + instructor + equipment + compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['em-1'],
        preferredBoatSlugs: ['boat-1'],
        preferredCompressorSlugs: ['comp-1'],
        boatCapabilities: { 'boat-1': { hasCompressor: false } },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('returns isComplete with confined venue + open water venue + compressor slug', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['em-1'],
        preferredVenueSlugs: ['pool-1', 'site-1'],
        preferredCompressorSlugs: ['comp-1'],
        venueCapabilities: {
          'pool-1': { venueType: 'Pool', confinedCapable: true, hasCompressor: false },
          'site-1': { venueType: 'DiveSite', confinedCapable: false, hasCompressor: false },
        },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })
})

// ── Instructor coverage ────────────────────────────────────────────────────────

describe('checkPreferenceCoverage — instructor', () => {
  it('missing when no instructor slugs', () => {
    const result = checkPreferenceCoverage(makeInput({ preferredInstructorSlugs: [] }))
    expect(result.missing).toContain('instructor')
  })

  it('satisfied with one instructor', () => {
    const result = checkPreferenceCoverage(makeInput({ preferredInstructorSlugs: ['inst-1'] }))
    expect(result.missing).not.toContain('instructor')
  })

  it('satisfied with multiple instructors', () => {
    const result = checkPreferenceCoverage(
      makeInput({ preferredInstructorSlugs: ['inst-1', 'inst-2', 'inst-3'] }),
    )
    expect(result.missing).not.toContain('instructor')
  })
})

// ── Equipment Manager coverage ─────────────────────────────────────────────────

describe('checkPreferenceCoverage — equipmentManager', () => {
  it('missing when no equipment slugs', () => {
    const result = checkPreferenceCoverage(makeInput({ preferredEquipmentSlugs: [] }))
    expect(result.missing).toContain('equipmentManager')
  })

  it('satisfied with one equipment slug', () => {
    const result = checkPreferenceCoverage(makeInput({ preferredEquipmentSlugs: ['em-1'] }))
    expect(result.missing).not.toContain('equipmentManager')
  })
})

// ── Boat satisfies both venue needs ────────────────────────────────────────────

describe('checkPreferenceCoverage — boat coverage', () => {
  it('boat satisfies both confinedWater and openWater', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredBoatSlugs: ['boat-1'],
        boatCapabilities: { 'boat-1': { hasCompressor: false } },
      }),
    )
    expect(result.missing).not.toContain('confinedWater')
    expect(result.missing).not.toContain('openWater')
  })

  it('boat with hasCompressor also satisfies compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredBoatSlugs: ['boat-1'],
        boatCapabilities: { 'boat-1': { hasCompressor: true } },
      }),
    )
    expect(result.missing).not.toContain('compressor')
    expect(result.missing).not.toContain('confinedWater')
    expect(result.missing).not.toContain('openWater')
  })

  it('boat without hasCompressor still needs compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredBoatSlugs: ['boat-1'],
        boatCapabilities: { 'boat-1': { hasCompressor: false } },
      }),
    )
    expect(result.missing).toContain('compressor')
  })

  it('boat with no matching capabilities still satisfies venue needs', () => {
    // Boat slug exists but no entry in boatCapabilities — boat presence alone is enough
    const result = checkPreferenceCoverage(
      makeInput({ preferredBoatSlugs: ['boat-1'] }),
    )
    expect(result.missing).not.toContain('confinedWater')
    expect(result.missing).not.toContain('openWater')
  })
})

// ── Venue coverage ─────────────────────────────────────────────────────────────

describe('checkPreferenceCoverage — venue coverage', () => {
  it('confined-capable pool satisfies both confinedWater and openWater', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredVenueSlugs: ['pool-1'],
        venueCapabilities: {
          'pool-1': { venueType: 'Pool', confinedCapable: true, hasCompressor: false },
        },
      }),
    )
    expect(result.missing).not.toContain('confinedWater')
    expect(result.missing).not.toContain('openWater')
  })

  it('non-confined Pool does not satisfy confinedWater', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredVenueSlugs: ['pool-1'],
        venueCapabilities: {
          'pool-1': { venueType: 'Pool', confinedCapable: false, hasCompressor: false },
        },
      }),
    )
    expect(result.missing).toContain('confinedWater')
  })

  it('non-Pool venue (DiveSite) satisfies openWater but not confinedWater', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredVenueSlugs: ['site-1'],
        venueCapabilities: {
          'site-1': { venueType: 'DiveSite', confinedCapable: false, hasCompressor: false },
        },
      }),
    )
    expect(result.missing).not.toContain('openWater')
    expect(result.missing).toContain('confinedWater')
  })

  it('venue with hasCompressor satisfies compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredVenueSlugs: ['site-1'],
        venueCapabilities: {
          'site-1': { venueType: 'DiveSite', confinedCapable: false, hasCompressor: true },
        },
      }),
    )
    expect(result.missing).not.toContain('compressor')
  })

  it('venue slug not in capabilities is skipped', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredVenueSlugs: ['unknown-venue'],
        venueCapabilities: {},
      }),
    )
    expect(result.missing).toContain('confinedWater')
    expect(result.missing).toContain('openWater')
  })
})

// ── Compressor coverage ────────────────────────────────────────────────────────

describe('checkPreferenceCoverage — compressor', () => {
  it('standalone compressor slug satisfies compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({ preferredCompressorSlugs: ['comp-1'] }),
    )
    expect(result.missing).not.toContain('compressor')
  })

  it('venue hasCompressor satisfies compressor (no standalone needed)', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredVenueSlugs: ['site-1'],
        venueCapabilities: {
          'site-1': { venueType: 'DiveSite', confinedCapable: false, hasCompressor: true },
        },
      }),
    )
    expect(result.missing).not.toContain('compressor')
  })

  it('boat hasCompressor satisfies compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredBoatSlugs: ['boat-1'],
        boatCapabilities: { 'boat-1': { hasCompressor: true } },
      }),
    )
    expect(result.missing).not.toContain('compressor')
  })

  it('multiple sources of compressor all work (venue + boat + standalone)', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredVenueSlugs: ['site-1'],
        preferredBoatSlugs: ['boat-1'],
        preferredCompressorSlugs: ['comp-1'],
        venueCapabilities: {
          'site-1': { venueType: 'DiveSite', confinedCapable: false, hasCompressor: true },
        },
        boatCapabilities: { 'boat-1': { hasCompressor: true } },
      }),
    )
    expect(result.missing).not.toContain('compressor')
  })
})

// ── Combined scenarios ─────────────────────────────────────────────────────────

describe('checkPreferenceCoverage — combined scenarios', () => {
  it('instructor + EM only → missing confinedWater, openWater, compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['em-1'],
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toEqual(['confinedWater', 'openWater', 'compressor'])
  })

  it('boat covers venues but still needs instructor + EM + compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredBoatSlugs: ['boat-1'],
        boatCapabilities: { 'boat-1': { hasCompressor: false } },
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toEqual(['instructor', 'equipmentManager', 'compressor'])
  })

  it('everything except compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['em-1'],
        preferredBoatSlugs: ['boat-1'],
        boatCapabilities: { 'boat-1': { hasCompressor: false } },
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toEqual(['compressor'])
  })

  it('multiple boats — one with compressor is enough', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['em-1'],
        preferredBoatSlugs: ['boat-1', 'boat-2'],
        boatCapabilities: {
          'boat-1': { hasCompressor: false },
          'boat-2': { hasCompressor: true },
        },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('multiple venues — combined capabilities satisfy all venue needs', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['em-1'],
        preferredVenueSlugs: ['pool-1', 'site-1'],
        preferredCompressorSlugs: ['comp-1'],
        venueCapabilities: {
          'pool-1': { venueType: 'Pool', confinedCapable: true, hasCompressor: false },
          'site-1': { venueType: 'DiveSite', confinedCapable: false, hasCompressor: false },
        },
      }),
    )
    expect(result.isComplete).toBe(true)
  })
})
