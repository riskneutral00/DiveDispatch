/**
 * Preference coverage validation.
 * Pure function — no framework dependencies. Lives in convex/shared/ so both
 * server (convex/) and client (src/lib/) can import without violating the
 * dependency direction rule.
 *
 * Before an operator can create a booking, their preferred resources must
 * collectively satisfy five requirements: instructor, equipment manager,
 * confined water venue, open water venue, and compressor.
 *
 * Boats satisfy ALL venue needs (captain picks the site).
 * Venues and boats can bundle compressor capability (hasCompressor).
 */

export interface VenueCapabilities {
  venueType: string
  confinedCapable: boolean
  hasCompressor: boolean
}

export interface BoatCapabilities {
  hasCompressor: boolean
}

export interface CoverageInput {
  preferredInstructorSlugs: string[]
  preferredEquipmentSlugs: string[]
  preferredVenueSlugs: string[]
  preferredBoatSlugs: string[]
  preferredCompressorSlugs: string[]
  venueCapabilities: Record<string, VenueCapabilities>
  boatCapabilities: Record<string, BoatCapabilities>
}

export interface CoverageResult {
  isComplete: boolean
  missing: string[]
}

export function checkPreferenceCoverage(input: CoverageInput): CoverageResult {
  const missing: string[] = []

  // 1. Instructor — at least one preferred
  if (input.preferredInstructorSlugs.length === 0) {
    missing.push('instructor')
  }

  // 2. Equipment Manager — at least one preferred
  if (input.preferredEquipmentSlugs.length === 0) {
    missing.push('equipmentManager')
  }

  // A boat satisfies both confined and open water venue needs
  const hasBoat = input.preferredBoatSlugs.length > 0

  // Scan venue capabilities
  // Confined water: boat OR venue with confinedCapable
  // Open water: boat OR dive site (always open water) OR confined-capable pool
  let hasConfinedVenue = hasBoat
  let hasOpenWaterVenue = hasBoat
  let hasCompressorAnywhere =
    input.preferredCompressorSlugs.length > 0

  for (const slug of input.preferredVenueSlugs) {
    const caps = input.venueCapabilities[slug]
    if (!caps) continue
    if (caps.confinedCapable) {
      hasConfinedVenue = true
      hasOpenWaterVenue = true
    }
    if (caps.venueType !== 'Pool') hasOpenWaterVenue = true
    if (caps.hasCompressor) hasCompressorAnywhere = true
  }

  // Scan boat capabilities for bundled compressor
  for (const slug of input.preferredBoatSlugs) {
    const caps = input.boatCapabilities[slug]
    if (!caps) continue
    if (caps.hasCompressor) hasCompressorAnywhere = true
  }

  // 3. Confined water venue
  if (!hasConfinedVenue) {
    missing.push('confinedWater')
  }

  // 4. Open water venue
  if (!hasOpenWaterVenue) {
    missing.push('openWater')
  }

  // 5. Compressor
  if (!hasCompressorAnywhere) {
    missing.push('compressor')
  }

  return {
    isComplete: missing.length === 0,
    missing,
  }
}
