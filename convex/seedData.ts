import type { StakeholderRole } from './lib/validators'
export type { StakeholderRole }

export const PHUKET_TH_ADDRESS = { city: 'Phuket', country: 'TH' } as const
export const PHUKET = { address: PHUKET_TH_ADDRESS, lat: 7.8804, lng: 98.3923 } as const
export const CHALONG = { address: { city: 'Phuket', state: 'Phuket', country: 'TH' } as const, lat: 7.8386, lng: 98.3519 } as const
export const VERIFIED = true

export const PADI_PREFS = { owDays: 3, aowDays: 2, oaDays: 4, selectedSpecialties: ['Deep', 'Drift', 'Wreck', 'Navigation'] }
export const SSI_PREFS = { owDays: 3, aowDays: 2, oaDays: 4, selectedSpecialties: ['Deep', 'Navigation', 'Wreck'] }

export type BoatType = 'day_boat' | 'speedboat' | 'longtail' | 'liveaboard' | 'catamaran' | 'rib'

export type GasMixType = 'air' | 'nitrox'

export type SeedAppLanguage = 'en' | 'zh-CN' | 'zh-TW' | 'th' | 'fr' | 'ko'

export type VenueKind = 'pool' | 'dive_site'

export type VenueFeature =
  | 'reef' | 'wreck' | 'cave' | 'wall'
  | 'drift' | 'muck' | 'altitude'
  | 'lake' | 'river' | 'quarry'
  | 'night' | 'deep'

export interface SeedAddress {
  street?: string
  city: string
  state?: string
  country: string
  postalCode?: string
}

export interface SeedUser {
  slug: string
  email: string
  firstName: string
  lastName: string
  nickname?: string
  appLanguage: SeedAppLanguage
  phone: string
  dateOfBirth: string
  customerLanguages?: string[]
}

export interface SeedOrganization {
  name: string
  slug: string
  isAreaOrg?: boolean
  destinationSlugs?: string[]
}

interface DiveCenterProfile {
  name: string
  address: SeedAddress
  lat: number
  lng: number
  email: string
  phone: string
  associations: {
    agency: string
    number: string
    owDays?: number
    aowDays?: number
    oaDays?: number
    selectedSpecialties?: string[]
  }[]
  customerLanguages?: string[]
  isAllowed?: string[]
  notAllowed?: string[]
  verified: boolean
}

interface BoatProfile {
  name: string
  address: SeedAddress
  lat: number
  lng: number
  email: string
  phone: string
  fleet: {
    boatName: string
    maxPax: number
    minPax?: number
    boatType: BoatType
    seatCapacity?: number
    routes?: { venueSlugs: string[]; daysOfWeek: number[] }[]
    cutoffHours?: number
  }[]
  isAllowed?: string[]
  notAllowed?: string[]
  verified: boolean
}

interface VenueProfile {
  slug?: string
  name: string
  kind: VenueKind
  features: VenueFeature[]
  address: SeedAddress
  lat: number
  lng: number
  email?: string
  phone?: string
  verified: boolean
  confinedCapable?: boolean
  maxDepth?: number
  maxCapacity?: number
  isAllowed?: string[]
  notAllowed?: string[]
}

interface EquipmentProfile {
  name: string
  address: SeedAddress
  lat: number
  lng: number
  placeId?: string
  email: string
  phone: string
  manufacturersByGearType?: Record<string, string[]>
  isAllowed?: string[]
  notAllowed?: string[]
  verified: boolean
}

interface CompressorProfile {
  slug: string
  name: string
  address: SeedAddress
  lat: number
  lng: number
  placeId?: string
  email: string
  phone: string
  gasMixes?: GasMixType[]
  nitroxMin?: number
  nitroxMax?: number
  isAllowed?: string[]
  notAllowed?: string[]
  verified: boolean
}

interface AgentProfile {
  name: string
  address: SeedAddress
  lat: number
  lng: number
  email: string
  phone: string
  associations: { agency: string; number: string }[]
  isAllowed?: string[]
  notAllowed?: string[]
  verified: boolean
}

interface InstructorProfile {
  name: string
  role: 'Instructor'
  address: SeedAddress
  lat: number
  lng: number
  email: string
  phone: string
  teachingLanguages: string[]
  credential: {
    agency: string
    level: string
    agencyID: string
    specialtyRatings: string[]
  }[]
  isAllowed?: string[]
  notAllowed?: string[]
  verified: boolean
}

export interface SeedStakeholder {
  user: SeedUser
  organization?: SeedOrganization
  roles?: { role: StakeholderRole }[]
  diveCenter?: DiveCenterProfile
  boat?: BoatProfile
  venues?: VenueProfile[]
  equipment?: EquipmentProfile
  compressors?: CompressorProfile[]
  agent?: AgentProfile
  instructor?: InstructorProfile
}

export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0]

export const ALL_STAKEHOLDERS: SeedStakeholder[] = []
export const ALL_INSTRUCTORS: SeedStakeholder[] = []
