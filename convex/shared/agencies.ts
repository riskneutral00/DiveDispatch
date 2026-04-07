export interface AgencySpecialtyEntry {
  code: string
  label: string
  adventureDiveName: string | null
  specialtyCourseName: string | null
  requiredForAOW: boolean
}

export type AgencySpecialty = AgencySpecialtyEntry

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
  specialties: AgencySpecialtyEntry[]
  specialtyGroupLabel: string
}

export const AOW_REQUIRED_SPECIALTY_COUNT = 5

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
      { code: 'Deep', label: 'Deep', adventureDiveName: 'Adventure Deep Dive', specialtyCourseName: 'Deep Diver Course', requiredForAOW: true },
      { code: 'Navigation', label: 'Navigation', adventureDiveName: 'Adventure Nav Dive', specialtyCourseName: 'Underwater Navigator', requiredForAOW: true },
      { code: 'PPB', label: 'PPB', adventureDiveName: 'PPB Specialty', specialtyCourseName: null, requiredForAOW: false },
      { code: 'Sidemount', label: 'Sidemount', adventureDiveName: null, specialtyCourseName: 'Sidemount Specialty', requiredForAOW: false },
      { code: 'Self-Reliant', label: 'Self-Reliant', adventureDiveName: null, specialtyCourseName: 'Self-Reliant Specialty', requiredForAOW: false },
      { code: 'Enriched Air', label: 'Enriched Air', adventureDiveName: null, specialtyCourseName: 'Enriched Air Nitrox', requiredForAOW: false },
      { code: 'Wreck', label: 'Wreck', adventureDiveName: 'Adventure Wreck Dive', specialtyCourseName: 'Wreck Diver Course', requiredForAOW: false },
      { code: 'Boat', label: 'Boat', adventureDiveName: 'Adventure Boat Dive', specialtyCourseName: 'Boat Diver Course', requiredForAOW: false },
      { code: 'Drift', label: 'Drift', adventureDiveName: 'Adventure Drift Dive', specialtyCourseName: 'Drift Diver Course', requiredForAOW: false },
      { code: 'Night', label: 'Night', adventureDiveName: 'Adventure Night Dive', specialtyCourseName: 'Night Diver Course', requiredForAOW: false },
      { code: 'Dry Suit', label: 'Dry Suit', adventureDiveName: 'Adventure Dry Suit', specialtyCourseName: 'Dry Suit Diver', requiredForAOW: false },
      { code: 'S&R', label: 'S&R', adventureDiveName: 'Adventure S&R Dive', specialtyCourseName: 'Search & Recovery', requiredForAOW: false },
      { code: 'DPV', label: 'DPV', adventureDiveName: 'Adventure DPV Dive', specialtyCourseName: 'Diver Propulsion Veh.', requiredForAOW: false },
      { code: 'Altitude', label: 'Altitude', adventureDiveName: 'Adventure Altitude', specialtyCourseName: 'Altitude Diver', requiredForAOW: false },
      { code: 'Ice', label: 'Ice', adventureDiveName: null, specialtyCourseName: 'Ice Diver Specialty', requiredForAOW: false },
      { code: 'Rebreather', label: 'Rebreather', adventureDiveName: null, specialtyCourseName: 'Rebreather Diver', requiredForAOW: false },
      { code: 'O2 Provider', label: 'O2 Provider', adventureDiveName: null, specialtyCourseName: 'Emergency O2 Provider', requiredForAOW: false },
      { code: 'Fish ID', label: 'Fish ID', adventureDiveName: 'Adventure Fish ID', specialtyCourseName: 'Fish Identification', requiredForAOW: false },
      { code: 'Marine Ecology', label: 'Marine Ecology', adventureDiveName: 'Adventure Naturalist', specialtyCourseName: 'Underwater Naturalist', requiredForAOW: false },
      { code: 'Shark/Turtle', label: 'Shark/Turtle', adventureDiveName: 'AWARE Specialties', specialtyCourseName: null, requiredForAOW: false },
      { code: 'Photo/Video', label: 'Photo/Video', adventureDiveName: 'Adventure Photo/Video', specialtyCourseName: 'Digital U/W Photo', requiredForAOW: false },
      { code: 'Equipment', label: 'Equipment', adventureDiveName: null, specialtyCourseName: 'Equipment Specialist', requiredForAOW: false },
      { code: 'Science of Diving', label: 'Science of Diving', adventureDiveName: null, specialtyCourseName: 'Science of Diving', requiredForAOW: false },
    ],
    specialtyGroupLabel: 'Specialties',
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
      { code: 'Deep', label: 'Deep Diving', adventureDiveName: 'Adv. Adventurer Deep', specialtyCourseName: 'Deep Diving', requiredForAOW: true },
      { code: 'Navigation', label: 'Navigation', adventureDiveName: 'Adv. Adventurer Nav', specialtyCourseName: 'Navigation', requiredForAOW: true },
      { code: 'PPB', label: 'Perfect Buoyancy', adventureDiveName: 'Perfect Buoyancy', specialtyCourseName: null, requiredForAOW: false },
      { code: 'Sidemount', label: 'Sidemount', adventureDiveName: null, specialtyCourseName: 'Sidemount Specialty', requiredForAOW: false },
      { code: 'Self-Reliant', label: 'Independent Diving', adventureDiveName: null, specialtyCourseName: 'Independent Diving', requiredForAOW: false },
      { code: 'Enriched Air', label: 'Enriched Air', adventureDiveName: null, specialtyCourseName: 'Enriched Air Nitrox', requiredForAOW: false },
      { code: 'Wreck', label: 'Wreck Diving', adventureDiveName: 'Adv. Adventurer Wreck', specialtyCourseName: 'Wreck Diving', requiredForAOW: false },
      { code: 'Boat', label: 'Boat Diving', adventureDiveName: 'Adv. Adventurer Boat', specialtyCourseName: 'Boat Diving', requiredForAOW: false },
      { code: 'Drift', label: 'Waves & Currents', adventureDiveName: 'Adv. Adventurer Waves', specialtyCourseName: 'Waves, Tides & Currents', requiredForAOW: false },
      { code: 'Night', label: 'Night & Ltd. Vis', adventureDiveName: 'Adv. Adventurer Night', specialtyCourseName: 'Night & Ltd. Visibility', requiredForAOW: false },
      { code: 'Dry Suit', label: 'Dry Suit', adventureDiveName: 'Adv. Adventurer Dry Suit', specialtyCourseName: 'Dry Suit Diving', requiredForAOW: false },
      { code: 'S&R', label: 'Search & Recovery', adventureDiveName: 'Adv. Adventurer S&R', specialtyCourseName: 'Search & Recovery', requiredForAOW: false },
      { code: 'DPV', label: 'Scooter/DPV', adventureDiveName: 'Adv. Adventurer Scooter', specialtyCourseName: 'Scooter/DPV', requiredForAOW: false },
      { code: 'Altitude', label: 'Altitude Diving', adventureDiveName: 'Adv. Adventurer Altitude', specialtyCourseName: 'Altitude Diving', requiredForAOW: false },
      { code: 'Ice', label: 'Ice Diving', adventureDiveName: null, specialtyCourseName: 'Ice Diving', requiredForAOW: false },
      { code: 'Rebreather', label: 'Rebreather', adventureDiveName: null, specialtyCourseName: 'Semi-Closed Rebreather', requiredForAOW: false },
      { code: 'O2 Provider', label: 'React Right', adventureDiveName: null, specialtyCourseName: 'React Right (O2)', requiredForAOW: false },
      { code: 'Fish ID', label: 'Fish ID', adventureDiveName: null, specialtyCourseName: 'Fish Identification', requiredForAOW: false },
      { code: 'Marine Ecology', label: 'Marine Ecology', adventureDiveName: null, specialtyCourseName: 'Marine Ecology', requiredForAOW: false },
      { code: 'Shark/Turtle', label: 'Shark/Turtle', adventureDiveName: null, specialtyCourseName: 'Shark/Turtle Ecology', requiredForAOW: false },
      { code: 'Photo/Video', label: 'Photo & Video', adventureDiveName: 'Adv. Adventurer Photo', specialtyCourseName: 'Photo & Video', requiredForAOW: false },
      { code: 'Equipment', label: 'Equipment', adventureDiveName: null, specialtyCourseName: 'Equipment Techniques', requiredForAOW: false },
      { code: 'Science of Diving', label: 'Science of Diving', adventureDiveName: null, specialtyCourseName: 'Science of Diving', requiredForAOW: false },
    ],
    specialtyGroupLabel: 'Specialty Programs',
  },
}

export const AGENCY_CODES = Object.keys(AGENCIES)

export const COURSE_DAY_RANGES = {
  OW: { min: 2, max: 4 },
  AOW: { min: 2, max: 4 },
  combined: { min: 4, max: 6 },
} as const

export function getMandatorySpecialties(agencyCode: string): Set<string> {
  const agency = AGENCIES[agencyCode]
  if (!agency) return new Set()
  return new Set(agency.specialties.filter((s) => s.requiredForAOW).map((s) => s.code))
}

export function getDefaultSpecialties(agencyCode: string): string[] {
  return [...getMandatorySpecialties(agencyCode)]
}
