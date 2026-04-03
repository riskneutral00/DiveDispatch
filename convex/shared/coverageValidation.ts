/**
 * Preference coverage validation.
 * Pure function — no framework dependencies. Lives in convex/shared/ so both
 * server (convex/) and client (src/lib/) can import without violating the
 * dependency direction rule.
 *
 * Before an operator can create a booking, their preferred resources must
 * collectively satisfy four requirements: instructor, equipment manager,
 * venue or boat, and compressor.
 *
 * Boats satisfy the venue requirement (captain picks the site).
 * Boats can also satisfy the compressor requirement via hasCompressor.
 */

export interface BoatCapabilities {
  hasCompressor: boolean
}

export interface CoverageInput {
  preferredInstructorSlugs: string[]
  preferredEquipmentSlugs: string[]
  preferredVenueSlugs: string[]
  preferredBoatSlugs: string[]
  preferredCompressorSlugs: string[]
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

  // 3. Venue or Boat — at least one venue slug OR one boat slug
  const hasVenueOrBoat =
    input.preferredVenueSlugs.length > 0 || input.preferredBoatSlugs.length > 0
  if (!hasVenueOrBoat) {
    missing.push('venueOrBoat')
  }

  // 4. Compressor — standalone compressor slug OR a boat with hasCompressor
  let hasCompressorAnywhere = input.preferredCompressorSlugs.length > 0
  for (const slug of input.preferredBoatSlugs) {
    const caps = input.boatCapabilities[slug]
    if (caps?.hasCompressor) {
      hasCompressorAnywhere = true
      break
    }
  }
  if (!hasCompressorAnywhere) {
    missing.push('compressor')
  }

  return {
    isComplete: missing.length === 0,
    missing,
  }
}
