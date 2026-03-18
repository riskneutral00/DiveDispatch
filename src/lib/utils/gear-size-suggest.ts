// Pure TS utility — no Convex, no React.
// Matches customer body measurements to gear sizes from the EM's gearSizingLookup entries.

export type GearType = 'wetsuit' | 'bcd' | 'fins' | 'mask' | 'regulator'

export interface DiverMeasurements {
  heightCm?: number
  weightKg?: number
  shoeSize?: number
  shoeSizeUnit?: 'EU' | 'US' | 'CM'
}

export interface SizingEntry {
  manufacturer: string
  gearType: string
  size: string
  minHeight: number
  maxHeight: number
  minWeight: number
  maxWeight: number
  shoeSize?: number
  shoeSizeUnit?: string
}

export type GearSuggestion =
  | { status: 'match'; manufacturer: string; size: string }
  | { status: 'no_match' }
  | { status: 'no_data' } // mask/regulator, or missing measurements

/**
 * Suggests gear sizes for each gear type a diver is renting.
 * Queries the EM's gearSizingLookup entries (filtered by manufacturer preference).
 *
 * Returns a record of gearType → GearSuggestion for each item in `rentingTypes`.
 * - 'match': suggested manufacturer + size
 * - 'no_match': measurements fall outside all known ranges → flag for manual sizing
 * - 'no_data': mask/regulator (no size chart), or measurements not yet submitted
 */
export function suggestGearSizes(
  measurements: DiverMeasurements,
  sizingEntries: SizingEntry[],
  rentingTypes: GearType[],
  manufacturersByGearType?: Record<string, string[]>,
): Record<string, GearSuggestion> {
  const result: Record<string, GearSuggestion> = {}
  for (const gearType of rentingTypes) {
    result[gearType] = suggestForGearType(
      measurements,
      sizingEntries,
      gearType,
      manufacturersByGearType?.[gearType],
    )
  }
  return result
}

function suggestForGearType(
  measurements: DiverMeasurements,
  sizingEntries: SizingEntry[],
  gearType: string,
  preferredManufacturers?: string[],
): GearSuggestion {
  // mask and regulator: no size matching available
  if (gearType === 'mask' || gearType === 'regulator') {
    return { status: 'no_data' }
  }

  let entries = sizingEntries.filter((e) => e.gearType === gearType)
  if (preferredManufacturers && preferredManufacturers.length > 0) {
    entries = entries.filter((e) => preferredManufacturers.includes(e.manufacturer))
  }

  if (entries.length === 0) return { status: 'no_data' }

  if (gearType === 'fins') return suggestFinSize(measurements, entries)
  return suggestByHeightWeight(measurements, entries)
}

function suggestFinSize(
  measurements: DiverMeasurements,
  entries: SizingEntry[],
): GearSuggestion {
  if (measurements.shoeSize == null) return { status: 'no_data' }
  const euSize = normalizeToEU(measurements.shoeSize, measurements.shoeSizeUnit ?? 'EU')

  // Exact shoeSize field match first
  const exact = entries.find((e) => e.shoeSize != null && e.shoeSize === euSize)
  if (exact) return { status: 'match', manufacturer: exact.manufacturer, size: exact.size }

  // Range-based: minHeight/maxHeight repurposed as shoe-size range for fin records
  const rangeMatch = entries.find(
    (e) => e.shoeSize == null && euSize >= e.minHeight && euSize <= e.maxHeight,
  )
  if (rangeMatch) {
    return { status: 'match', manufacturer: rangeMatch.manufacturer, size: rangeMatch.size }
  }

  return { status: 'no_match' }
}

function suggestByHeightWeight(
  measurements: DiverMeasurements,
  entries: SizingEntry[],
): GearSuggestion {
  if (measurements.heightCm == null || measurements.weightKg == null) return { status: 'no_data' }
  const h = measurements.heightCm
  const w = measurements.weightKg

  const matches = entries.filter(
    (e) => h >= e.minHeight && h <= e.maxHeight && w >= e.minWeight && w <= e.maxWeight,
  )
  if (matches.length === 0) return { status: 'no_match' }

  // Prefer narrowest height range to resolve overlapping bands
  const best = matches.reduce((prev, curr) =>
    curr.maxHeight - curr.minHeight < prev.maxHeight - prev.minHeight ? curr : prev,
  )
  return { status: 'match', manufacturer: best.manufacturer, size: best.size }
}

function normalizeToEU(shoeSize: number, unit: string): number {
  if (unit === 'US') return shoeSize + 33
  if (unit === 'CM') return Math.round(shoeSize / 0.667)
  return shoeSize // already EU
}
