import { describe, it, expect } from 'vitest'
import {
  checkPreferenceCoverage,
  type CoverageInput,
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
    boatCapabilities: {},
    ...overrides,
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
    preferredVenueSlugs: ['venue-a'],
    preferredBoatSlugs: [],
    preferredCompressorSlugs: ['comp-a'],
    boatCapabilities: {},
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('checkPreferenceCoverage', () => {
  it('returns complete when all four requirements are met', () => {
    const result = checkPreferenceCoverage(fullCoverage())
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  // ── Missing individual requirements ───────────────────────────────

  it('reports missing instructor when none preferred', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({ preferredInstructorSlugs: [] }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('instructor')
  })

  it('reports missing equipmentManager when none preferred', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({ preferredEquipmentSlugs: [] }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('equipmentManager')
  })

  it('reports missing venueOrBoat when no venue and no boat', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredVenueSlugs: [],
        preferredBoatSlugs: [],
        boatCapabilities: {},
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('venueOrBoat')
  })

  it('has venue but no boat — still passes venueOrBoat', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredVenueSlugs: ['venue-a'],
        preferredBoatSlugs: [],
        boatCapabilities: {},
      }),
    )
    expect(result.missing).not.toContain('venueOrBoat')
  })

  it('has boat but no venue — still passes venueOrBoat', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredVenueSlugs: [],
        preferredBoatSlugs: ['boat-a'],
        boatCapabilities: { 'boat-a': boat() },
      }),
    )
    expect(result.missing).not.toContain('venueOrBoat')
  })

  it('reports missing compressor when no compressor source exists', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredCompressorSlugs: [],
        preferredBoatSlugs: [],
        boatCapabilities: {},
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('compressor')
  })

  // ── Boat compressor satisfaction ─────────────────────────────────

  it('boat with hasCompressor satisfies compressor requirement', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredCompressorSlugs: [],
        preferredBoatSlugs: ['boat-a'],
        boatCapabilities: { 'boat-a': boat({ hasCompressor: true }) },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).not.toContain('compressor')
  })

  it('boat without hasCompressor does NOT satisfy compressor requirement', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredCompressorSlugs: [],
        preferredBoatSlugs: ['boat-a'],
        boatCapabilities: { 'boat-a': boat({ hasCompressor: false }) },
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('compressor')
  })

  // ── All missing ──────────────────────────────────────────────────

  it('reports all four missing when input is completely empty', () => {
    const result = checkPreferenceCoverage(makeInput())
    expect(result.isComplete).toBe(false)
    expect(result.missing).toEqual([
      'instructor',
      'equipmentManager',
      'venueOrBoat',
      'compressor',
    ])
  })

  // ── Combined partial scenarios ───────────────────────────────────

  it('fails when only instructor is set', () => {
    const result = checkPreferenceCoverage(
      makeInput({ preferredInstructorSlugs: ['inst-1'] }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).not.toContain('instructor')
    expect(result.missing).toContain('equipmentManager')
    expect(result.missing).toContain('venueOrBoat')
    expect(result.missing).toContain('compressor')
  })

  it('instructor + EM only leaves venueOrBoat and compressor missing', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['em-1'],
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toEqual(['venueOrBoat', 'compressor'])
  })

  it('everything except compressor is incomplete', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['em-1'],
        preferredBoatSlugs: ['boat-1'],
        boatCapabilities: { 'boat-1': boat({ hasCompressor: false }) },
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
          'boat-1': boat({ hasCompressor: false }),
          'boat-2': boat({ hasCompressor: true }),
        },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  // ── Unknown boat slug is ignored ─────────────────────────────────

  it('ignores boat slugs not in boatCapabilities for compressor check', () => {
    const result = checkPreferenceCoverage(
      fullCoverage({
        preferredCompressorSlugs: [],
        preferredBoatSlugs: ['unknown-boat'],
        boatCapabilities: {},
      }),
    )
    expect(result.missing).toContain('compressor')
  })

  // ── Standalone compressor slug ──────────────────────────────────

  it('standalone compressor slug satisfies compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({ preferredCompressorSlugs: ['comp-1'] }),
    )
    expect(result.missing).not.toContain('compressor')
  })

  // ── Full pass variants ───────────────────────────────────────────

  it('passes with boat with compressor covering all needs', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredBoatSlugs: ['boat-1'],
        boatCapabilities: { 'boat-1': boat({ hasCompressor: true }) },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('passes with venue + standalone compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredVenueSlugs: ['venue-1'],
        preferredCompressorSlugs: ['comp-1'],
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('passes with boat without compressor + standalone compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredBoatSlugs: ['boat-1'],
        preferredCompressorSlugs: ['comp-1'],
        boatCapabilities: { 'boat-1': boat() },
      }),
    )
    expect(result.isComplete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('fails with boat without compressor and no standalone compressor', () => {
    const result = checkPreferenceCoverage(
      makeInput({
        preferredInstructorSlugs: ['inst-1'],
        preferredEquipmentSlugs: ['equip-1'],
        preferredBoatSlugs: ['boat-1'],
        boatCapabilities: { 'boat-1': boat() },
      }),
    )
    expect(result.isComplete).toBe(false)
    expect(result.missing).toEqual(['compressor'])
  })
})
