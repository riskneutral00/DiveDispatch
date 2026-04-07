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

  if (input.preferredInstructorSlugs.length === 0) {
    missing.push('instructor')
  }

  if (input.preferredEquipmentSlugs.length === 0) {
    missing.push('equipmentManager')
  }

  const hasVenueOrBoat =
    input.preferredVenueSlugs.length > 0 || input.preferredBoatSlugs.length > 0
  if (!hasVenueOrBoat) {
    missing.push('venueOrBoat')
  }

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
