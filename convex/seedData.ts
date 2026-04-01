// Seed data constants for all stakeholders.
// Consumed by convex/seed.ts internal mutations.

import type { StakeholderRole } from './lib/validators'
export type { StakeholderRole }

// ── Shared Defaults ─────────────────────────────────────────────────

const PHUKET = { placeName: 'Phuket', country: 'Thailand', lat: 7.8804, lng: 98.3923 } as const
const CHALONG = { placeName: 'Phuket', country: 'Thailand', lat: 7.8386, lng: 98.3519 } as const
const VERIFIED = true

const PADI_PREFS = { owDays: 3, aowDays: 2, oaDays: 4, selectedSpecialties: ['Deep', 'Drift', 'Wreck', 'Navigation'] }
const SSI_PREFS = { owDays: 3, aowDays: 2, oaDays: 4, selectedSpecialties: ['Deep', 'Navigation', 'Wreck'] }

export type BoatType = 'day_boat' | 'speedboat' | 'longtail' | 'liveaboard' | 'catamaran' | 'rib'

export type GasMixType = 'air' | 'nitrox' | 'trimix'

export interface SeedUser {
  slug: string
  email: string
  name: string
  firstName: string
  lastName: string
  businessName: string
  appLanguage: string
  phone: string
  customerLanguages?: string[]
}

interface DiveCenterProfile {
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
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
  customerLanguages: string[]
  verified: boolean
}

interface BoatProfile {
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
  email: string
  phone: string
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
  email: string
  phone: string
  verified: boolean
  venueType: 'Pool' | 'Shore' | 'Reef' | 'Lake' | 'River' | 'Quarry' | 'Other'
  isPublic: boolean
  confinedCapable: boolean
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
  email: string
  phone: string
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
  email: string
  phone: string
  gasMixes?: GasMixType[]
  verified: boolean
}

interface LiveaboardProfile {
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
  email: string
  phone: string
  verified: boolean
}

interface DiveResortProfile {
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
  email: string
  phone: string
  verified: boolean
}

interface AgentProfile {
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
  email: string
  phone: string
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
  email: string
  phone: string
  /** ISO-ish codes, aligned with `users.customerLanguages` / directory. */
  teachingLanguages: string[]
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
  roles?: { role: StakeholderRole }[]
  diveCenter?: DiveCenterProfile
  boat?: BoatProfile
  pool?: VenueProfile
  equipment?: EquipmentProfile
  compressor?: CompressorProfile
  agent?: AgentProfile
  instructor?: InstructorProfile
  liveaboard?: LiveaboardProfile
  diveResort?: DiveResortProfile
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
    name: 'Somchai Prasert',
    firstName: 'Somchai',
    lastName: 'Prasert',
    businessName: 'Hug Ocean',
    appLanguage: 'zh-CN',
    phone: '+66-81-234-5001',
  },
  roles: [
    { role: 'DiveCenter' },
    { role: 'Boat' },
    { role: 'Pool' },
    { role: 'Equipment' },
  ],
  diveCenter: {
    name: 'Hug Ocean',
    ...PHUKET,
    email: 'hug-ocean@divedispatch.dev',
    phone: '+66-76-381-100',
    associations: [{ agency: 'PADI', number: 'S-34782', ...PADI_PREFS }],
    customerLanguages: ['zh-CN', 'zh-TW', 'th', 'en'],
    verified: VERIFIED,
  },
  boat: {
    name: 'M.V. Hug Ocean',
    ...PHUKET,
    email: 'hug-ocean@divedispatch.dev',
    phone: '+66-76-381-101',
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
    email: 'hug-ocean@divedispatch.dev',
    phone: '+66-76-381-102',
    maxDepth: 3,
    maxCapacity: 15,
    verified: VERIFIED,
    venueType: 'Pool',
    isPublic: false,
    confinedCapable: true,

    hasCompressor: false,
  },
  equipment: {
    name: 'Hug Ocean',
    ...PHUKET,
    email: 'hug-ocean@divedispatch.dev',
    phone: '+66-76-381-103',
    manufacturersByGearType: { wetsuit: ['ScubaPro'], bcd: ['ScubaPro'] },
    verified: VERIFIED,
  },
}

// ── 2. Neptune (DC + Pool + Equipment) ─────────────────────────────

export const NEPTUNE: SeedStakeholder = {
  user: {
    slug: 'z8mv4c',
    email: 'neptune+clerk_test@divedispatch.dev',
    name: 'Wei Lin',
    firstName: 'Wei',
    lastName: 'Lin',
    businessName: 'Neptune',
    appLanguage: 'zh-CN',
    phone: '+66-81-234-5002',
  },
  roles: [
    { role: 'DiveCenter' },
    { role: 'Pool' },
    { role: 'Equipment' },
  ],
  diveCenter: {
    name: 'Neptune',
    ...PHUKET,
    email: 'neptune@divedispatch.dev',
    phone: '+66-76-383-001',
    associations: [{ agency: 'PADI', number: 'S-41256', ...PADI_PREFS }],
    customerLanguages: ['zh-CN', 'zh-TW', 'en', 'th'],
    verified: VERIFIED,
  },
  pool: {
    name: 'Neptune',
    ...PHUKET,
    email: 'neptune@divedispatch.dev',
    phone: '+66-76-383-002',
    maxDepth: 2.5,
    maxCapacity: 6,
    verified: VERIFIED,
    venueType: 'Pool',
    isPublic: false,
    confinedCapable: true,

    hasCompressor: false,
  },
  equipment: {
    name: 'Neptune',
    ...PHUKET,
    email: 'neptune@divedispatch.dev',
    phone: '+66-76-383-003',
    manufacturersByGearType: { wetsuit: ['Aqua Lung'], bcd: ['Aqua Lung'] },
    verified: VERIFIED,
  },
}

// ── 3. Phuket Dive Center (DC + Boat + Equipment) ─────────────────

export const PHUKET_DC: SeedStakeholder = {
  user: {
    slug: 'p5ky3w',
    email: 'phuket-dive-center+clerk_test@divedispatch.dev',
    name: 'Kittisak Charoen',
    firstName: 'Kittisak',
    lastName: 'Charoen',
    businessName: 'Phuket Dive Center',
    appLanguage: 'th',
    phone: '+66-81-234-5003',
  },
  roles: [
    { role: 'DiveCenter' },
    { role: 'Boat' },
    { role: 'Equipment' },
  ],
  diveCenter: {
    name: 'Phuket Dive Center',
    ...PHUKET,
    email: 'phuket-dive-center@divedispatch.dev',
    phone: '+66-76-385-001',
    associations: [{ agency: 'PADI', number: 'S-29815', ...PADI_PREFS }],
    customerLanguages: ['th', 'en', 'zh-CN', 'ko'],
    verified: VERIFIED,
  },
  boat: {
    name: 'Phuket Dive Center',
    ...PHUKET,
    email: 'phuket-dive-center@divedispatch.dev',
    phone: '+66-76-385-002',
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
    email: 'phuket-dive-center@divedispatch.dev',
    phone: '+66-76-385-003',
    manufacturersByGearType: { wetsuit: ['Mares'], bcd: ['Mares'] },
    verified: VERIFIED,
  },
}

// ── 4. Nicole Dive Center (DC + Equipment) ─────────────────────────

export const NICOLE_DC: SeedStakeholder = {
  user: {
    slug: 'q9bz7r',
    email: 'nicole-dive-center+clerk_test@divedispatch.dev',
    name: 'Nicole Huang',
    firstName: 'Nicole',
    lastName: 'Huang',
    businessName: 'Nicole Dive Center',
    appLanguage: 'zh-TW',
    phone: '+66-81-234-5004',
  },
  roles: [
    { role: 'DiveCenter' },
    { role: 'Equipment' },
  ],
  diveCenter: {
    name: 'Nicole Dive Center',
    ...PHUKET,
    email: 'nicole-dive-center@divedispatch.dev',
    phone: '+66-76-386-001',
    associations: [{ agency: 'PADI', number: 'S-55198', ...PADI_PREFS }],
    customerLanguages: ['zh-TW', 'zh-CN', 'en', 'th'],
    verified: VERIFIED,
  },
  equipment: {
    name: 'Nicole Dive Center',
    ...PHUKET,
    email: 'nicole-dive-center@divedispatch.dev',
    phone: '+66-76-386-002',
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
    name: 'Pierre Duval',
    firstName: 'Pierre',
    lastName: 'Duval',
    businessName: 'Manta Dive Center',
    appLanguage: 'fr',
    phone: '+66-81-234-5005',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Manta Dive Center',
    ...PHUKET,
    email: 'manta-dive-center@divedispatch.dev',
    phone: '+66-76-387-001',
    associations: [{ agency: 'SSI', number: 'DC-80234', ...SSI_PREFS }],
    customerLanguages: ['fr', 'en', 'th'],
    verified: VERIFIED,
  },
}

// ── 6. ScubaNicks (DC + Equipment) ─────────────────────────────────

export const SCUBANICKS: SeedStakeholder = {
  user: {
    slug: 'm4fx8d',
    email: 'scubanicks+clerk_test@divedispatch.dev',
    name: 'Nick Harrison',
    firstName: 'Nick',
    lastName: 'Harrison',
    businessName: 'ScubaNicks',
    appLanguage: 'en',
    phone: '+66-81-234-5006',
  },
  roles: [
    { role: 'DiveCenter' },
    { role: 'Equipment' },
  ],
  diveCenter: {
    name: 'ScubaNicks',
    ...PHUKET,
    email: 'scubanicks@divedispatch.dev',
    phone: '+66-76-388-001',
    associations: [{ agency: 'SSI', number: 'DC-91547', ...SSI_PREFS }],
    customerLanguages: ['en', 'th', 'zh-CN'],
    verified: VERIFIED,
  },
  equipment: {
    name: 'ScubaNicks',
    ...PHUKET,
    email: 'scubanicks@divedispatch.dev',
    phone: '+66-76-388-002',
    manufacturersByGearType: { wetsuit: ['ScubaPro'], bcd: ['ScubaPro'] },
    verified: VERIFIED,
  },
}

// ── 7. Scuba Deep (DC + Equipment) ─────────────────────────────────

export const SCUBA_DEEP: SeedStakeholder = {
  user: {
    slug: 'h3cp6n',
    email: 'scuba-deep+clerk_test@divedispatch.dev',
    name: 'James Mitchell',
    firstName: 'James',
    lastName: 'Mitchell',
    businessName: 'Scuba Deep',
    appLanguage: 'en',
    phone: '+66-81-234-5007',
  },
  roles: [
    { role: 'DiveCenter' },
    { role: 'Equipment' },
  ],
  diveCenter: {
    name: 'Scuba Deep',
    ...PHUKET,
    email: 'scuba-deep@divedispatch.dev',
    phone: '+66-76-389-001',
    associations: [
      { agency: 'SSI', number: 'DC-72019', ...SSI_PREFS },
      { agency: 'PADI', number: 'S-61834', ...PADI_PREFS },
    ],
    customerLanguages: ['en', 'th', 'zh-CN', 'fr'],
    verified: VERIFIED,
  },
  equipment: {
    name: 'Scuba Deep',
    ...PHUKET,
    email: 'scuba-deep@divedispatch.dev',
    phone: '+66-76-389-003',
    manufacturersByGearType: { wetsuit: ['Mares'], bcd: ['Mares'] },
    verified: VERIFIED,
  },
}

// ── 8. Sirolo (DC + Boat + Equipment) ──────────────────────────────

export const SIROLO: SeedStakeholder = {
  user: {
    slug: 'sirolo',
    email: 'sirolo+clerk_test@divedispatch.dev',
    name: 'Prasit Wongsawat',
    firstName: 'Prasit',
    lastName: 'Wongsawat',
    businessName: 'Sirolo',
    appLanguage: 'th',
    phone: '+66-81-234-5008',
  },
  roles: [
    { role: 'DiveCenter' },
    { role: 'Boat' },
    { role: 'Equipment' },
  ],
  diveCenter: {
    name: 'Sirolo',
    ...CHALONG,
    email: 'sirolo@divedispatch.dev',
    phone: '+66-76-391-001',
    associations: [{ agency: 'PADI', number: 'S-70123', ...PADI_PREFS }],
    customerLanguages: ['th', 'en', 'zh-CN', 'zh-TW'],
    verified: VERIFIED,
  },
  boat: {
    name: 'Sirolo',
    ...CHALONG,
    email: 'sirolo@divedispatch.dev',
    phone: '+66-76-391-002',
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
    email: 'sirolo@divedispatch.dev',
    phone: '+66-76-391-003',
    manufacturersByGearType: { wetsuit: ['Mares'], bcd: ['Mares'] },
    verified: VERIFIED,
  },
}

// ── 9. Pray Dive Center (DC only) ──────────────────────────────────

export const PRAY_DC: SeedStakeholder = {
  user: {
    slug: 't7gw1k',
    email: 'pray-dive-center+clerk_test@divedispatch.dev',
    name: 'Anong Srisuk',
    firstName: 'Anong',
    lastName: 'Srisuk',
    businessName: 'Pray Dive Center',
    appLanguage: 'en',
    phone: '+66-81-234-5009',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Pray Dive Center',
    ...PHUKET,
    email: 'pray-dive-center@divedispatch.dev',
    phone: '+66-76-390-001',
    associations: [{ agency: 'PADI', number: 'S-48203', ...PADI_PREFS }],
    customerLanguages: ['en', 'th'],
    verified: VERIFIED,
  },
}

// ── 10. Amanda (Agent) ─────────────────────────────────────────────

export const AMANDA: SeedStakeholder = {
  user: {
    slug: 'r5yz4q',
    email: 'amanda+clerk_test@divedispatch.dev',
    name: 'Amanda Chen',
    firstName: 'Amanda',
    lastName: 'Chen',
    businessName: 'Amanda',
    appLanguage: 'zh-CN',
    phone: '+66-81-234-5010',
    customerLanguages: ['zh-CN', 'zh-TW', 'en', 'th'],
  },
  roles: [
    { role: 'Agent' },
  ],
  agent: {
    name: 'Amanda',
    ...PHUKET,
    email: 'amanda@divedispatch.dev',
    phone: '+66-81-555-0012',
    associations: [{ agency: 'PADI', number: 'A-10482' }],
    defaultReferralMode: 'independent',
    verified: VERIFIED,
  },
}

// ── 11. Andaman Explorer (Liveaboard) ─────────────────────────────

export const ANDAMAN_EXPLORER: SeedStakeholder = {
  user: {
    slug: 'k8lv3a',
    email: 'andaman-explorer+clerk_test@divedispatch.dev',
    name: 'Chaiwat Meesuk',
    firstName: 'Chaiwat',
    lastName: 'Meesuk',
    businessName: 'Andaman Explorer',
    appLanguage: 'en',
    phone: '+66-81-234-5011',
  },
  roles: [
    { role: 'Liveaboard' },
  ],
  liveaboard: {
    name: 'Andaman Explorer',
    ...PHUKET,
    email: 'andaman-explorer@divedispatch.dev',
    phone: '+66-76-392-001',
    verified: VERIFIED,
  },
}

// ── 12. Chalong Pier — standalone compressor (slug matches convex/seedBookingData COMPRESSOR_SLUG)

export const CHALONG_COMPRESSOR: SeedStakeholder = {
  user: {
    slug: 'x4kp2m',
    email: 'compressor-chalong+clerk_test@divedispatch.dev',
    name: 'Sombat Charoensuk',
    firstName: 'Sombat',
    lastName: 'Charoensuk',
    businessName: 'Compressor Shop Chalong Pier',
    appLanguage: 'th',
    phone: '+66-81-234-5014',
  },
  roles: [{ role: 'Compressor' }],
  compressor: {
    name: 'Compressor Shop Chalong Pier',
    ...CHALONG,
    email: 'compressor-chalong@divedispatch.dev',
    phone: '+66-76-395-001',
    gasMixes: ['air', 'nitrox'],
    verified: VERIFIED,
  },
}

// ── 13. Coral Bay Resort (DiveResort) ─────────────────────────────

export const CORAL_BAY_RESORT: SeedStakeholder = {
  user: {
    slug: 'j2dn9f',
    email: 'coral-bay-resort+clerk_test@divedispatch.dev',
    name: 'Supattra Laohakul',
    firstName: 'Supattra',
    lastName: 'Laohakul',
    businessName: 'Coral Bay Resort',
    appLanguage: 'th',
    phone: '+66-81-234-5012',
  },
  roles: [
    { role: 'DiveResort' },
  ],
  diveResort: {
    name: 'Coral Bay Resort',
    ...PHUKET,
    email: 'coral-bay-resort@divedispatch.dev',
    phone: '+66-76-393-001',
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
  CHALONG_COMPRESSOR,
  ANDAMAN_EXPLORER,
  CORAL_BAY_RESORT,
]

