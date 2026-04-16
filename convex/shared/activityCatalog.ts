import { v, type Infer } from 'convex/values'

export const ACTIVITY_CODES = [
  'DSD',
  'TRY_DIVE',
  'OW',
  'AOW',
  'RESCUE',
  'DM',
  'FD',
  'REFRESH',
  'SPECIALTY',
] as const

export type ActivityCode = (typeof ACTIVITY_CODES)[number]

const literals = ACTIVITY_CODES.map((c) => v.literal(c)) as [
  ReturnType<typeof v.literal<(typeof ACTIVITY_CODES)[0]>>,
  ...ReturnType<typeof v.literal<(typeof ACTIVITY_CODES)[number]>>[],
]
export const activityCodeValidator = v.union(...literals)

type ValidatorType = Infer<typeof activityCodeValidator>
type _Check = ValidatorType extends ActivityCode
  ? ActivityCode extends ValidatorType
    ? true
    : never
  : never
const _guard: _Check = true
void _guard

export const COURSE_CODES = ACTIVITY_CODES
export type CourseCode = ActivityCode
export const courseCodeValidator = activityCodeValidator
export const Rank = {
  DM: 1,
  AI: 2,
  Instructor: 3,
  Staff: 4,
  Director: 5,
} as const

export type RankLevel = (typeof Rank)[keyof typeof Rank]
export interface AgencyLevel {
  code: string
  rank: RankLevel
}

export interface AgencyActivityRule {
  name: string
  minRank: RankLevel
  requiresRating: boolean
  minDays: number
  requiresConfined: boolean
  prerequisites: ActivityCode[]
  repeatable: boolean
  description: string
}

export interface AgencySpecialtyEntry {
  code: string
  label: string
  adventureDiveName: string | null
  specialtyCourseName: string | null
  requiredForAOW: boolean
}

export type AgencySpecialty = AgencySpecialtyEntry

export interface AgencyConfig {
  code: string
  name: string
  memberIdLabel: string
  levels: AgencyLevel[]
  activityRules: Record<ActivityCode, AgencyActivityRule>
  specialties: AgencySpecialtyEntry[]
  automaticAuthority: string[]
  aowRequiredSpecialtyCount: number
  specialtyGroupLabel: string
}
const PADI_LEVELS: AgencyLevel[] = [
  { code: 'Divemaster', rank: Rank.DM },
  { code: 'OWSI', rank: Rank.Instructor },
  { code: 'MSDT', rank: Rank.Instructor },
  { code: 'IDC Staff Instructor', rank: Rank.Staff },
  { code: 'Course Director', rank: Rank.Director },
]

const PADI_ACTIVITY_RULES: Record<ActivityCode, AgencyActivityRule> = {
  FD: { name: 'Fun Dive', minRank: Rank.DM, requiresRating: false, minDays: 1, requiresConfined: false, prerequisites: ['OW'], repeatable: true, description: 'Recreational diving for certified divers' },
  DSD: { name: 'Discover Scuba Diving', minRank: Rank.DM, requiresRating: false, minDays: 1, requiresConfined: false, prerequisites: [], repeatable: true, description: 'Introductory dive for non-certified divers' },
  TRY_DIVE: { name: 'Try Dive', minRank: Rank.DM, requiresRating: false, minDays: 1, requiresConfined: false, prerequisites: [], repeatable: true, description: 'Informal DSD alternative for dive centers not following official PADI SOP' },
  OW: { name: 'Open Water Diver', minRank: Rank.Instructor, requiresRating: false, minDays: 3, requiresConfined: true, prerequisites: [], repeatable: false, description: 'Entry-level certification with confined and open water dives' },
  AOW: { name: 'Advanced Open Water Diver', minRank: Rank.Instructor, requiresRating: false, minDays: 2, requiresConfined: false, prerequisites: ['OW'], repeatable: false, description: 'Five adventure dives including deep and navigation' },
  RESCUE: { name: 'Rescue Diver', minRank: Rank.Instructor, requiresRating: false, minDays: 2, requiresConfined: false, prerequisites: ['AOW'], repeatable: false, description: 'Self-rescue and diver-rescue skills with emergency scenarios' },
  DM: { name: 'Divemaster', minRank: Rank.Instructor, requiresRating: false, minDays: 5, requiresConfined: false, prerequisites: ['RESCUE'], repeatable: false, description: 'Professional-level training to lead and assist dive activities' },
  REFRESH: { name: 'ReActivate', minRank: Rank.Instructor, requiresRating: false, minDays: 1, requiresConfined: false, prerequisites: ['OW'], repeatable: false, description: 'Skills review for certified divers returning after a break' },
  SPECIALTY: { name: 'Specialty Course', minRank: Rank.Instructor, requiresRating: true, minDays: 1, requiresConfined: false, prerequisites: ['OW'], repeatable: true, description: 'Specialty diving courses (Deep, Wreck, Nitrox, etc.)' },
}

const PADI_SPECIALTIES: AgencySpecialtyEntry[] = [
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
]

export const PADI: AgencyConfig = {
  code: 'PADI',
  name: 'PADI',
  memberIdLabel: 'Member Number',
  levels: PADI_LEVELS,
  activityRules: PADI_ACTIVITY_RULES,
  specialties: PADI_SPECIALTIES,
  automaticAuthority: ['PPB', 'Shark/Turtle'],
  aowRequiredSpecialtyCount: 5,
  specialtyGroupLabel: 'Specialties',
}
const SSI_LEVELS: AgencyLevel[] = [
  { code: 'Dive Guide', rank: Rank.DM },
  { code: 'OWI', rank: Rank.Instructor },
  { code: 'Advanced OWI', rank: Rank.Instructor },
  { code: 'Instructor Trainer', rank: Rank.Staff },
  { code: 'Instructor Certifier', rank: Rank.Director },
]

const SSI_ACTIVITY_RULES: Record<ActivityCode, AgencyActivityRule> = {
  FD: { name: 'Fun Dive', minRank: Rank.DM, requiresRating: false, minDays: 1, requiresConfined: false, prerequisites: ['OW'], repeatable: true, description: 'Recreational diving for certified divers' },
  DSD: { name: 'Try Scuba Diving', minRank: Rank.DM, requiresRating: false, minDays: 1, requiresConfined: false, prerequisites: [], repeatable: true, description: 'Introductory dive for non-certified divers' },
  TRY_DIVE: { name: 'Try Dive', minRank: Rank.DM, requiresRating: false, minDays: 1, requiresConfined: false, prerequisites: [], repeatable: true, description: 'Informal introductory dive alternative for dive centers not following official SSI SOP' },
  OW: { name: 'Open Water Diver', minRank: Rank.Instructor, requiresRating: false, minDays: 3, requiresConfined: true, prerequisites: [], repeatable: false, description: 'Entry-level certification with confined and open water dives' },
  AOW: { name: 'Advanced Adventurer', minRank: Rank.Instructor, requiresRating: false, minDays: 2, requiresConfined: false, prerequisites: ['OW'], repeatable: false, description: 'Five specialty dives to explore advanced techniques' },
  RESCUE: { name: 'Diver Stress & Rescue', minRank: Rank.Instructor, requiresRating: false, minDays: 2, requiresConfined: false, prerequisites: ['AOW'], repeatable: false, description: 'Stress management and rescue techniques for real-world scenarios' },
  DM: { name: 'Dive Guide', minRank: Rank.Instructor, requiresRating: false, minDays: 5, requiresConfined: false, prerequisites: ['RESCUE'], repeatable: false, description: 'Professional-level training to guide certified divers' },
  REFRESH: { name: 'Scuba Skills Update', minRank: Rank.Instructor, requiresRating: false, minDays: 1, requiresConfined: false, prerequisites: ['OW'], repeatable: false, description: 'Skills review for certified divers returning after a break' },
  SPECIALTY: { name: 'Specialty Program', minRank: Rank.Instructor, requiresRating: true, minDays: 1, requiresConfined: false, prerequisites: ['OW'], repeatable: true, description: 'Specialty diving courses (Deep, Wreck, Enriched Air, etc.)' },
}

const SSI_SPECIALTIES: AgencySpecialtyEntry[] = [
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
]

export const SSI: AgencyConfig = {
  code: 'SSI',
  name: 'SSI',
  memberIdLabel: 'Instructor Number',
  levels: SSI_LEVELS,
  activityRules: SSI_ACTIVITY_RULES,
  specialties: SSI_SPECIALTIES,
  automaticAuthority: ['PPB', 'Shark/Turtle'],
  aowRequiredSpecialtyCount: 5,
  specialtyGroupLabel: 'Specialty Programs',
}
export const AGENCY_CONFIGS: Record<string, AgencyConfig> = { PADI, SSI }
export const AGENCY_CODES = Object.keys(AGENCY_CONFIGS)
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

function toAgencyDefinition(config: AgencyConfig): AgencyDefinition {
  return {
    code: config.code,
    name: config.name,
    memberIdLabel: config.memberIdLabel,
    courses: [
      { code: 'OW', label: 'OW' },
      { code: 'AOW', label: 'AOW' },
    ],
    combinedLabel: 'O+A',
    specialties: config.specialties,
    specialtyGroupLabel: config.specialtyGroupLabel,
  }
}

export const AGENCIES: Record<string, AgencyDefinition> = {
  PADI: toAgencyDefinition(PADI),
  SSI: toAgencyDefinition(SSI),
}

export const AOW_REQUIRED_SPECIALTY_COUNT = 5

export const COURSE_DAY_RANGES = {
  OW: { min: 2, max: 4 },
  AOW: { min: 2, max: 4 },
  combined: { min: 4, max: 6 },
} as const

export function getMandatorySpecialties(agencyCode: string): Set<string> {
  const config = AGENCY_CONFIGS[agencyCode]
  if (!config) return new Set()
  return new Set(config.specialties.filter((s) => s.requiredForAOW).map((s) => s.code))
}

export function getDefaultSpecialties(agencyCode: string): string[] {
  return [...getMandatorySpecialties(agencyCode)]
}
export type Agency = string

export interface ActivityCatalogEntry {
  code: ActivityCode
  name: string
  agency: Agency
  minDays: number
  requiresConfined: boolean
  prerequisites: ActivityCode[]
  description: string
  repeatable: boolean
}

export type CourseCatalogEntry = ActivityCatalogEntry

function buildCatalogEntries(config: AgencyConfig): ActivityCatalogEntry[] {
  return ACTIVITY_CODES.map((code) => {
    const rule = config.activityRules[code]
    return {
      code,
      name: rule.name,
      agency: config.code,
      minDays: rule.minDays,
      requiresConfined: rule.requiresConfined,
      prerequisites: rule.prerequisites,
      description: rule.description,
      repeatable: rule.repeatable,
    }
  })
}

export const ACTIVITY_CATALOG: ActivityCatalogEntry[] = [
  ...buildCatalogEntries(PADI),
  ...buildCatalogEntries(SSI),
]

export const COURSE_CATALOG = ACTIVITY_CATALOG

export const ACTIVITY_DISPLAY_LABELS: Record<ActivityCode, string> = {
  DSD: 'DSD',
  TRY_DIVE: 'Try Dive',
  OW: 'OW',
  AOW: 'AOW',
  RESCUE: 'Rescue',
  DM: 'DM',
  FD: 'FD',
  REFRESH: 'Refresh',
  SPECIALTY: 'Specialty',
}

export const COURSE_DISPLAY_LABELS = ACTIVITY_DISPLAY_LABELS
export const ALL_COURSE_CODES: ActivityCode[] = [...ACTIVITY_CODES]

export function activityLabel(code: string): string {
  return ACTIVITY_DISPLAY_LABELS[code as ActivityCode] ?? code
}

export const courseLabel = activityLabel

export function getActivityByCode(code: ActivityCode, agency?: string): ActivityCatalogEntry | undefined {
  if (agency) {
    return ACTIVITY_CATALOG.find((entry) => entry.code === code && entry.agency === agency)
  }
  return ACTIVITY_CATALOG.find((entry) => entry.code === code)
}

export const getCourseByCode = getActivityByCode

export function getActivitiesForAgency(agency: Agency): ActivityCatalogEntry[] {
  return ACTIVITY_CATALOG.filter((entry) => entry.agency === agency)
}

export const getCoursesForAgency = getActivitiesForAgency

export const COMBO_COURSES = {
  'O+A': { codes: ['OW', 'AOW'] as ActivityCode[], label: 'O+A (OW + AOW)', minDays: 4 },
} as const
export const ACTIVITY_MIN_AGE: Record<ActivityCode, number> = {
  DSD: 10,
  TRY_DIVE: 10,
  OW: 10,
  AOW: 12,
  RESCUE: 12,
  DM: 18,
  FD: 10,
  REFRESH: 10,
  SPECIALTY: 12,
}

export function getMinAge(activityTypes: readonly ActivityCode[]): number {
  if (activityTypes.length === 0) return 0
  return Math.max(...activityTypes.map((t) => ACTIVITY_MIN_AGE[t] ?? 0))
}

export function requiresInstructorForAnyAgency(code: ActivityCode): boolean {
  return Object.values(AGENCY_CONFIGS).every(
    (config) => config.activityRules[code].minRank >= Rank.Instructor,
  )
}

export function getActivityRule(code: ActivityCode, agency: string): AgencyActivityRule | undefined {
  return AGENCY_CONFIGS[agency]?.activityRules[code]
}

export function getLevelsForAgency(agency: string): AgencyLevel[] {
  return AGENCY_CONFIGS[agency]?.levels ?? []
}

export function getLevelsForAgencyAtRank(agency: string, minRank: RankLevel): AgencyLevel[] {
  return getLevelsForAgency(agency).filter((l) => l.rank >= minRank)
}
