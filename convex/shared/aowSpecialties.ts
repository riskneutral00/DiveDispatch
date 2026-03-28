/**
 * Canonical AOW specialty values and mandatory set.
 * Pure data — no framework dependencies. Lives in convex/shared/ so both
 * server (convex/) and client (src/lib/) can import.
 */

export interface AowSpecialty {
  value: string
  label: string
  overflow?: true
}

export const AOW_SPECIALTIES = [
  { value: 'PPB', label: 'PPB' },
  { value: 'Navigation', label: 'Navigation' },
  { value: 'Wreck', label: 'Wreck' },
  { value: 'Deep', label: 'Deep' },
  { value: 'Night', label: 'Night' },
  { value: 'Boat', label: 'Boat' },
  { value: 'Drift', label: 'Drift' },
  { value: 'Dry Suit', label: 'Dry Suit' },
  { value: 'Fish ID', label: 'Fish ID' },
  // "More..." overflow
  { value: 'Photography', label: 'Photography', overflow: true },
  { value: 'S&R', label: 'S&R', overflow: true },
  { value: 'DUW Photo', label: 'DUW Photo', overflow: true },
  { value: 'Enriched Air', label: 'Enriched Air', overflow: true },
] as const satisfies readonly AowSpecialty[]

/** Valid AOW specialty code — compile-time subset check for agency catalogs. */
export type AowSpecialtyValue = (typeof AOW_SPECIALTIES)[number]['value']

export const AOW_MAIN = AOW_SPECIALTIES.filter((s) => !('overflow' in s))
export const AOW_OVERFLOW = AOW_SPECIALTIES.filter((s) => 'overflow' in s)

export const MANDATORY_AOW_SPECIALTIES = new Set<string>([
  'Navigation',
  'Deep',
])

/** All valid AOW specialty value strings. */
export const AOW_SPECIALTY_VALUES = AOW_SPECIALTIES.map((s) => s.value)
