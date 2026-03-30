import { describe, it, expect } from 'vitest'
import {
  checkPreferenceCoverage,
  type CoverageInput,
} from '../convex/shared/coverageValidation'

/** Helper: returns a fully-covered input so tests can selectively remove pieces. */
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

describe('checkPreferenceCoverage', () => {
  it('returns complete when all five requirements are met', () => {
    const result = checkPreferenceCoverage(fullCoverage())
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  // ── Missing individual requirements ───────────────────────────────

  it('reports missing instructor when none preferred', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({ preferredInstructorSlugs: [] })
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('instructor')
  })

  it('reports missing equipment manager when none preferred', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({ preferredEquipmentSlugs: [] })
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('equipmentManager')
  })

  it('reports missing compressor when no compressor source exists', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({ preferredCompressorSlugs: [] })
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
      })
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
      })
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

  // ── Boat satisfies venue and compressor needs ────────────────────

  it('boat satisfies both confined and open water needs', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredVenueSlugs: [],
        venueCapabilities: {},
        preferredBoatSlugs: ['boat-a'],
        boatCapabilities: { 'boat-a': { hasCompressor: true } },
      })
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
      })
    )
    expect(result.isComplete).toBe(true)
  })

  it('boat without compressor does not satisfy compressor requirement', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredCompressorSlugs: [],
        preferredBoatSlugs: ['boat-a'],
        boatCapabilities: { 'boat-a': { hasCompressor: false } },
      })
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
      })
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
      })
    )
    expect(result.missing).not.toContain('confinedWater')
    expect(result.missing).not.toContain('openWater')
  })

  // ── Unknown venue slug is ignored ────────────────────────────────

  it('ignores venue slugs not in venueCapabilities', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredVenueSlugs: ['unknown-venue'],
        venueCapabilities: {},
      })
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
      })
    )
    // Boat still satisfies venue (hasBoat check), but compressor not resolved
    expect(result.missing).toContain('compressor')
  })
})
