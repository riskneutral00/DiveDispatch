// Seed data constants for all stakeholders.
// Consumed by convex/seed.ts internal mutations.

import type { StakeholderRole } from './lib/validators'
export type { StakeholderRole }

// ── Shared Defaults ─────────────────────────────────────────────────

const PHUKET = { placeName: 'Phuket', country: 'Thailand', lat: 7.8804, lng: 98.3923 } as const
const CHALONG = { placeName: 'Phuket', country: 'Thailand', lat: 7.8386, lng: 98.3519 } as const
const VERIFIED = true
const BOOKING_DAYS = { owDays: 3, aowDays: 2, oaDays: 4 }

// All DCs share the same AOW specialty set
const DC_BOOKING_PREFS = { ...BOOKING_DAYS, aowSpecialties: ['Deep', 'Drift', 'Wreck'] }

export type BoatType = 'day_boat' | 'speedboat' | 'longtail' | 'liveaboard' | 'catamaran' | 'rib'

export type GasMixType = 'air' | 'nitrox' | 'trimix'

export interface SeedUser {
  slug: string
  email: string
  name: string
  firstName: string
  lastName: string
  businessName: string
  role: StakeholderRole
  preferredLocale: string
}

interface DiveCenterProfile {
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
  contactEmail: string
  contactPhone: string
  associations: { agency: string; number: string }[]
  verified: boolean
  bookingPreferences?: {
    owDays?: number
    aowDays?: number
    oaDays?: number
    aowSpecialties?: string[]
  }
}

interface BoatProfile {
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
  contactEmail: string
  contactPhone: string
  fleet: {
    boatName: string
    maxPax: number
    minPax?: number
    boatType: BoatType
    seatCapacity?: number
    routes?: { diveSite: string; daysOfWeek: number[] }[]
    cutoffHours?: number
  }[]
  hasCompressor: boolean
  verified: boolean
}

interface VenueProfile {
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
  contactEmail: string
  contactPhone: string
  verified: boolean
  venueType: 'Pool' | 'Shore' | 'Reef' | 'Lake' | 'River' | 'Quarry' | 'Other'
  isPublic: boolean
  confinedCapable: boolean
  openWaterCapable: boolean
  hasCompressor: boolean
  maxDepth?: number
  maxCapacity?: number
}

interface EquipmentProfile {
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
  contactEmail: string
  contactPhone: string
  manufacturersByGearType?: Record<string, string[]>
  verified: boolean
}

interface CompressorProfile {
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
  contactEmail: string
  contactPhone: string
  gasMixes?: GasMixType[]
  verified: boolean
}

interface AgentProfile {
  name: string
  locations: { placeName: string; country: string; lat: number; lng: number; placeId?: string }[]
  contactEmail: string
  contactPhone: string
  associations: { agency: string; number: string }[]
  defaultReferralMode: 'independent' | 'referral'
  verified: boolean
}

interface InstructorProfile {
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
  contactEmail: string
  contactPhone: string
  credential: {
    agency: string
    level: string
    agencyID: string
    courses: string[]
  }[]
  verified: boolean
}

export interface SeedStakeholder {
  user: SeedUser
  roles?: { role: StakeholderRole; isPrimary: boolean }[]
  diveCenter?: DiveCenterProfile
  boat?: BoatProfile
  pool?: VenueProfile
  equipment?: EquipmentProfile
  compressor?: CompressorProfile
  agent?: AgentProfile
  instructor?: InstructorProfile
}

/** Unowned dive sites -- public locations seeded without user accounts. */
export interface SeedDiveSite {
  name: string
  slug: string
  capacity: number
}

// ── Route Helpers ───────────────────────────────────────────────────

const RACHA = 'Racha Noi / Racha Yai'
const SHARK_KC = 'Shark Point / King Cruiser'
const PHI_PHI = 'Phi Phi'
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0] // Mon-Sun

// ── 1. Hug Ocean (DC + Boat + Pool + Equipment) ────────────────────

export const HUG_OCEAN: SeedStakeholder = {
  user: {
    slug: 'n7rq5j',
    email: 'hug-ocean+clerk_test@divedispatch.dev',
    name: 'Hug Ocean',
    firstName: 'Hug',
    lastName: 'Ocean',
    businessName: 'Hug Ocean',
    role: 'DiveCenter',
    preferredLocale: 'zh-CN',
  },
  roles: [
    { role: 'DiveCenter', isPrimary: true },
    { role: 'Boat', isPrimary: false },
    { role: 'Pool', isPrimary: false },
    { role: 'Equipment', isPrimary: false },
  ],
  diveCenter: {
    name: 'Hug Ocean',
    ...PHUKET,
    contactEmail: 'hug-ocean@divedispatch.dev',
    contactPhone: '+66-76-381-100',
    associations: [{ agency: 'PADI', number: 'S-34782' }],
    verified: VERIFIED,
    bookingPreferences: DC_BOOKING_PREFS,
  },
  boat: {
    name: 'M.V. Hug Ocean',
    ...PHUKET,
    contactEmail: 'hug-ocean@divedispatch.dev',
    contactPhone: '+66-76-381-101',
    fleet: [
      {
        boatName: 'M.V. Hug Ocean',
        maxPax: 50,
        boatType: 'day_boat',
        routes: [{ diveSite: RACHA, daysOfWeek: ALL_DAYS }],
      },
    ],
    hasCompressor: true,
    verified: VERIFIED,
  },
  pool: {
    name: 'Hug Ocean',
    ...PHUKET,
    contactEmail: 'hug-ocean@divedispatch.dev',
    contactPhone: '+66-76-381-102',
    maxDepth: 3,
    maxCapacity: 15,
    verified: VERIFIED,
    venueType: 'Pool',
    isPublic: false,
    confinedCapable: true,
    openWaterCapable: false,
    hasCompressor: false,
  },
  equipment: {
    name: 'Hug Ocean',
    ...PHUKET,
    contactEmail: 'hug-ocean@divedispatch.dev',
    contactPhone: '+66-76-381-103',
    manufacturersByGearType: { wetsuit: ['ScubaPro'], bcd: ['ScubaPro'] },
    verified: VERIFIED,
  },
}

// ── 2. Neptune (DC + Pool + Equipment) ─────────────────────────────

export const NEPTUNE: SeedStakeholder = {
  user: {
    slug: 'z8mv4c',
    email: 'neptune+clerk_test@divedispatch.dev',
    name: 'Neptune',
    firstName: 'Neptune',
    lastName: 'Dive',
    businessName: 'Neptune',
    role: 'DiveCenter',
    preferredLocale: 'zh-CN',
  },
  roles: [
    { role: 'DiveCenter', isPrimary: true },
    { role: 'Pool', isPrimary: false },
    { role: 'Equipment', isPrimary: false },
  ],
  diveCenter: {
    name: 'Neptune',
    ...PHUKET,
    contactEmail: 'neptune@divedispatch.dev',
    contactPhone: '+66-76-383-001',
    associations: [{ agency: 'PADI', number: 'S-41256' }],
    verified: VERIFIED,
    bookingPreferences: DC_BOOKING_PREFS,
  },
  pool: {
    name: 'Neptune',
    ...PHUKET,
    contactEmail: 'neptune@divedispatch.dev',
    contactPhone: '+66-76-383-002',
    maxDepth: 2.5,
    maxCapacity: 6,
    verified: VERIFIED,
    venueType: 'Pool',
    isPublic: false,
    confinedCapable: true,
    openWaterCapable: false,
    hasCompressor: false,
  },
  equipment: {
    name: 'Neptune',
    ...PHUKET,
    contactEmail: 'neptune@divedispatch.dev',
    contactPhone: '+66-76-383-003',
    manufacturersByGearType: { wetsuit: ['Aqua Lung'], bcd: ['Aqua Lung'] },
    verified: VERIFIED,
  },
}

// ── 3. Phuket Dive Center (DC + Boat + Equipment) ─────────────────

export const PHUKET_DC: SeedStakeholder = {
  user: {
    slug: 'p5ky3w',
    email: 'phuket-dive-center+clerk_test@divedispatch.dev',
    name: 'Phuket Dive Center',
    firstName: 'Phuket',
    lastName: 'Dive Center',
    businessName: 'Phuket Dive Center',
    role: 'DiveCenter',
    preferredLocale: 'th',
  },
  roles: [
    { role: 'DiveCenter', isPrimary: true },
    { role: 'Boat', isPrimary: false },
    { role: 'Equipment', isPrimary: false },
  ],
  diveCenter: {
    name: 'Phuket Dive Center',
    ...PHUKET,
    contactEmail: 'phuket-dive-center@divedispatch.dev',
    contactPhone: '+66-76-385-001',
    associations: [{ agency: 'PADI', number: 'S-29815' }],
    verified: VERIFIED,
    bookingPreferences: DC_BOOKING_PREFS,
  },
  boat: {
    name: 'Phuket Dive Center',
    ...PHUKET,
    contactEmail: 'phuket-dive-center@divedispatch.dev',
    contactPhone: '+66-76-385-002',
    fleet: [
      {
        boatName: 'M.V.MQ5',
        maxPax: 70,
        boatType: 'day_boat',
        routes: [
          { diveSite: RACHA, daysOfWeek: [1, 4, 6] },
          { diveSite: SHARK_KC, daysOfWeek: [2] },
          { diveSite: PHI_PHI, daysOfWeek: [3, 5, 0] },
        ],
      },
      {
        boatName: 'M.V.MQ7',
        maxPax: 90,
        boatType: 'day_boat',
        routes: [
          { diveSite: RACHA, daysOfWeek: [2, 5] },
          { diveSite: SHARK_KC, daysOfWeek: [3] },
          { diveSite: PHI_PHI, daysOfWeek: [1, 4, 6, 0] },
        ],
      },
    ],
    hasCompressor: false,
    verified: VERIFIED,
  },
  equipment: {
    name: 'Phuket Dive Center',
    ...PHUKET,
    contactEmail: 'phuket-dive-center@divedispatch.dev',
    contactPhone: '+66-76-385-003',
    manufacturersByGearType: { wetsuit: ['Mares'], bcd: ['Mares'] },
    verified: VERIFIED,
  },
}

// ── 4. Nicole Dive Center (DC + Equipment) ─────────────────────────

export const NICOLE_DC: SeedStakeholder = {
  user: {
    slug: 'q9bz7r',
    email: 'nicole-dive-center+clerk_test@divedispatch.dev',
    name: 'Nicole Dive Center',
    firstName: 'Nicole',
    lastName: 'Dive Center',
    businessName: 'Nicole Dive Center',
    role: 'DiveCenter',
    preferredLocale: 'zh-TW',
  },
  roles: [
    { role: 'DiveCenter', isPrimary: true },
    { role: 'Equipment', isPrimary: false },
  ],
  diveCenter: {
    name: 'Nicole Dive Center',
    ...PHUKET,
    contactEmail: 'nicole-dive-center@divedispatch.dev',
    contactPhone: '+66-76-386-001',
    associations: [{ agency: 'PADI', number: 'S-55198' }],
    verified: VERIFIED,
    bookingPreferences: DC_BOOKING_PREFS,
  },
  equipment: {
    name: 'Nicole Dive Center',
    ...PHUKET,
    contactEmail: 'nicole-dive-center@divedispatch.dev',
    contactPhone: '+66-76-386-002',
    manufacturersByGearType: {
      wetsuit: ['ScubaPro', 'Aqua Lung', 'Mares'],
      bcd: ['ScubaPro', 'Aqua Lung', 'Mares'],
    },
    verified: VERIFIED,
  },
}

// ── 5. Manta Dive Center (DC only) ─────────────────────────────────

export const MANTA_DC: SeedStakeholder = {
  user: {
    slug: 'v6js2t',
    email: 'manta-dive-center+clerk_test@divedispatch.dev',
    name: 'Manta Dive Center',
    firstName: 'Manta',
    lastName: 'Dive Center',
    businessName: 'Manta Dive Center',
    role: 'DiveCenter',
    preferredLocale: 'fr',
  },
  roles: [
    { role: 'DiveCenter', isPrimary: true },
  ],
  diveCenter: {
    name: 'Manta Dive Center',
    ...PHUKET,
    contactEmail: 'manta-dive-center@divedispatch.dev',
    contactPhone: '+66-76-387-001',
    associations: [{ agency: 'SSI', number: 'DC-80234' }],
    verified: VERIFIED,
    bookingPreferences: DC_BOOKING_PREFS,
  },
}

// ── 6. ScubaNicks (DC + Equipment) ─────────────────────────────────

export const SCUBANICKS: SeedStakeholder = {
  user: {
    slug: 'm4fx8d',
    email: 'scubanicks+clerk_test@divedispatch.dev',
    name: 'ScubaNicks',
    firstName: 'Nick',
    lastName: 'ScubaNicks',
    businessName: 'ScubaNicks',
    role: 'DiveCenter',
    preferredLocale: 'en',
  },
  roles: [
    { role: 'DiveCenter', isPrimary: true },
    { role: 'Equipment', isPrimary: false },
  ],
  diveCenter: {
    name: 'ScubaNicks',
    ...PHUKET,
    contactEmail: 'scubanicks@divedispatch.dev',
    contactPhone: '+66-76-388-001',
    associations: [{ agency: 'SSI', number: 'DC-91547' }],
    verified: VERIFIED,
    bookingPreferences: DC_BOOKING_PREFS,
  },
  equipment: {
    name: 'ScubaNicks',
    ...PHUKET,
    contactEmail: 'scubanicks@divedispatch.dev',
    contactPhone: '+66-76-388-002',
    manufacturersByGearType: { wetsuit: ['ScubaPro'], bcd: ['ScubaPro'] },
    verified: VERIFIED,
  },
}

// ── 7. Scuba Deep (DC + Equipment) ─────────────────────────────────

export const SCUBA_DEEP: SeedStakeholder = {
  user: {
    slug: 'h3cp6n',
    email: 'scuba-deep+clerk_test@divedispatch.dev',
    name: 'Scuba Deep',
    firstName: 'Scuba',
    lastName: 'Deep',
    businessName: 'Scuba Deep',
    role: 'DiveCenter',
    preferredLocale: 'en',
  },
  roles: [
    { role: 'DiveCenter', isPrimary: true },
    { role: 'Equipment', isPrimary: false },
  ],
  diveCenter: {
    name: 'Scuba Deep',
    ...PHUKET,
    contactEmail: 'scuba-deep@divedispatch.dev',
    contactPhone: '+66-76-389-001',
    associations: [
      { agency: 'SSI', number: 'DC-72019' },
      { agency: 'PADI', number: 'S-61834' },
    ],
    verified: VERIFIED,
    bookingPreferences: DC_BOOKING_PREFS,
  },
  equipment: {
    name: 'Scuba Deep',
    ...PHUKET,
    contactEmail: 'scuba-deep@divedispatch.dev',
    contactPhone: '+66-76-389-003',
    manufacturersByGearType: { wetsuit: ['Mares'], bcd: ['Mares'] },
    verified: VERIFIED,
  },
}

// ── 8. Sirolo (DC + Boat + Equipment) ──────────────────────────────

export const SIROLO: SeedStakeholder = {
  user: {
    slug: 'sirolo',
    email: 'sirolo+clerk_test@divedispatch.dev',
    name: 'Sirolo',
    firstName: 'Prasit',
    lastName: 'Wongsawat',
    businessName: 'Sirolo',
    role: 'DiveCenter',
    preferredLocale: 'th',
  },
  roles: [
    { role: 'DiveCenter', isPrimary: true },
    { role: 'Boat', isPrimary: false },
    { role: 'Equipment', isPrimary: false },
  ],
  diveCenter: {
    name: 'Sirolo',
    ...CHALONG,
    contactEmail: 'sirolo@divedispatch.dev',
    contactPhone: '+66-76-391-001',
    associations: [{ agency: 'PADI', number: 'S-70123' }],
    verified: VERIFIED,
    bookingPreferences: DC_BOOKING_PREFS,
  },
  boat: {
    name: 'Sirolo',
    ...CHALONG,
    contactEmail: 'sirolo@divedispatch.dev',
    contactPhone: '+66-76-391-002',
    fleet: [
      {
        boatName: 'M.V. Sirolo',
        maxPax: 70,
        boatType: 'day_boat',
        routes: [
          { diveSite: RACHA, daysOfWeek: [1, 2, 5, 6] },
          { diveSite: SHARK_KC, daysOfWeek: [3] },
          { diveSite: PHI_PHI, daysOfWeek: [4, 0] },
        ],
      },
    ],
    hasCompressor: false,
    verified: VERIFIED,
  },
  equipment: {
    name: 'Sirolo',
    ...CHALONG,
    contactEmail: 'sirolo@divedispatch.dev',
    contactPhone: '+66-76-391-003',
    manufacturersByGearType: { wetsuit: ['Mares'], bcd: ['Mares'] },
    verified: VERIFIED,
  },
}

// ── 9. Pray Dive Center (DC only) ──────────────────────────────────

export const PRAY_DC: SeedStakeholder = {
  user: {
    slug: 't7gw1k',
    email: 'pray-dive-center+clerk_test@divedispatch.dev',
    name: 'Pray Dive Center',
    firstName: 'Pray',
    lastName: 'Dive Center',
    businessName: 'Pray Dive Center',
    role: 'DiveCenter',
    preferredLocale: 'en',
  },
  roles: [
    { role: 'DiveCenter', isPrimary: true },
  ],
  diveCenter: {
    name: 'Pray Dive Center',
    ...PHUKET,
    contactEmail: 'pray-dive-center@divedispatch.dev',
    contactPhone: '+66-76-390-001',
    associations: [{ agency: 'PADI', number: 'S-48203' }],
    verified: VERIFIED,
    bookingPreferences: DC_BOOKING_PREFS,
  },
}

// ── 10. Amanda (Agent) ─────────────────────────────────────────────

export const AMANDA: SeedStakeholder = {
  user: {
    slug: 'r5yz4q',
    email: 'amanda+clerk_test@divedispatch.dev',
    name: 'Amanda',
    firstName: 'Amanda',
    lastName: 'Chen',
    businessName: 'Amanda',
    role: 'Agent',
    preferredLocale: 'zh-CN',
  },
  roles: [
    { role: 'Agent', isPrimary: true },
  ],
  agent: {
    name: 'Amanda',
    locations: [{ placeName: 'Phuket', country: 'Thailand', lat: 7.8804, lng: 98.3923 }],
    contactEmail: 'amanda@divedispatch.dev',
    contactPhone: '+66-81-555-0012',
    associations: [{ agency: 'PADI', number: 'A-10482' }],
    defaultReferralMode: 'independent',
    verified: VERIFIED,
  },
}

// ── Unowned Dive Sites (no user account) ────────────────────────────

export const UNOWNED_DIVE_SITES: SeedDiveSite[] = [
  { name: 'Kata Beach', slug: 'kata-beach', capacity: 50 },
]

// ── All Non-Instructor Stakeholders ─────────────────────────────────

export const ALL_STAKEHOLDERS: SeedStakeholder[] = [
  HUG_OCEAN,
  NEPTUNE,
  PHUKET_DC,
  NICOLE_DC,
  MANTA_DC,
  SCUBANICKS,
  SCUBA_DEEP,
  SIROLO,
  PRAY_DC,
  AMANDA,
]

// ── Hierarchy Links (cross-stakeholder relationships) ───────────────

export const HIERARCHY_LINKS: { parentSlug: string; parentType: StakeholderRole; childSlug: string; childType: StakeholderRole }[] = [
  // Scuba Deep uses Sirolo's boat
  { parentSlug: 'h3cp6n', parentType: 'DiveCenter', childSlug: 'sirolo', childType: 'Boat' },
]
