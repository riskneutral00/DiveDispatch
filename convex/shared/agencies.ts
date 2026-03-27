/**
 * Agency reference data — course catalogs, specialty lists, and labels.
 *
 * Pure data — no framework dependencies. Lives in convex/shared/ so both
 * server (convex/) and client (src/lib/) can import.
 *
 * Adding a new agency = adding an entry here. No code changes needed.
 */

export interface AgencySpecialty {
  code: string
  label: string
  mandatory?: true
}

export interface AgencyCourse {
  code: string
  label: string
}

export interface AgencyDefinition {
  code: string
  name: string
  memberIdLabel: string
  courses: AgencyCourse[]
  combinedLabel: string
  specialties: AgencySpecialty[]
  specialtyGroupLabel: string
  specialtyCount: number
}

export const AGENCIES: Record<string, AgencyDefinition> = {
  PADI: {
    code: 'PADI',
    name: 'PADI',
    memberIdLabel: 'Member Number',
    courses: [
      { code: 'OW', label: 'OW' },
      { code: 'AOW', label: 'AOW' },
    ],
    combinedLabel: 'O+A',
    specialties: [
      { code: 'PPB', label: 'PPB' },
      { code: 'Navigation', label: 'Navigation', mandatory: true },
      { code: 'Wreck', label: 'Wreck' },
      { code: 'Deep', label: 'Deep', mandatory: true },
      { code: 'Night', label: 'Night' },
      { code: 'Boat', label: 'Boat' },
      { code: 'Drift', label: 'Drift' },
      { code: 'Dry Suit', label: 'Dry Suit' },
      { code: 'Fish ID', label: 'Fish ID' },
      { code: 'Photography', label: 'Photography' },
      { code: 'S&R', label: 'S&R' },
      { code: 'DUW Photo', label: 'DUW Photo' },
    ],
    specialtyGroupLabel: 'Specialties',
    specialtyCount: 5,
  },
  SSI: {
    code: 'SSI',
    name: 'SSI',
    memberIdLabel: 'Instructor Number',
    courses: [
      { code: 'OW', label: 'OW' },
      { code: 'AOW', label: 'AOW' },
    ],
    combinedLabel: 'O+A',
    specialties: [
      { code: 'PPB', label: 'Perfect Buoyancy' },
      { code: 'Navigation', label: 'Navigation', mandatory: true },
      { code: 'Deep', label: 'Deep Diving', mandatory: true },
      { code: 'Wreck', label: 'Wreck Diving' },
      { code: 'Night', label: 'Night & Limited Visibility' },
      { code: 'Boat', label: 'Boat Diving' },
      { code: 'Search', label: 'Search & Recovery' },
      { code: 'Photo', label: 'Photo & Video' },
      { code: 'Fish ID', label: 'Marine Ecology' },
      { code: 'Enriched Air', label: 'Enriched Air Nitrox' },
    ],
    specialtyGroupLabel: 'Specialty Programs',
    specialtyCount: 4,
  },
}

/** All agency codes for dropdowns */
export const AGENCY_CODES = Object.keys(AGENCIES)

/** Course day ranges — universal across all agencies */
export const COURSE_DAY_RANGES = {
  OW: { min: 2, max: 4 },
  AOW: { min: 2, max: 4 },
  combined: { min: 4, max: 6 },
} as const

/** Get mandatory specialty codes for an agency */
export function getMandatorySpecialties(agencyCode: string): Set<string> {
  const agency = AGENCIES[agencyCode]
  if (!agency) return new Set()
  return new Set(agency.specialties.filter((s) => s.mandatory).map((s) => s.code))
}

/** Get default specialty selections for an agency (mandatory ones pre-selected) */
export function getDefaultSpecialties(agencyCode: string): string[] {
  return [...getMandatorySpecialties(agencyCode)]
}
