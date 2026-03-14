// Seed data constants for all stakeholders.
// Consumed by convex/seed.ts internal mutations.

// ── Shared Defaults ─────────────────────────────────────────────────

const PHUKET = { city: 'Phuket', country: 'Thailand' } as const
const VERIFIED = true
const LOCALE = 'en'
const ALL_DC_BOOKING_PREFS = {
  owDays: 3,
  aowDays: 2,
  oaDays: 4,
  aowSpecialties: ['Drift', 'Peak Performance Buoyancy', 'Wreck'],
}

// ── Types ───────────────────────────────────────────────────────────

export type StakeholderRole =
  | 'DiveCenter' | 'Agent' | 'Instructor' | 'Boat' | 'Equipment'
  | 'Pool' | 'Compressor' | 'DiveMaster' | 'Liveaboard' | 'DiveResort'
  | 'DiveHostel' | 'DiveSite'

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
  additionalRoles?: StakeholderRole[]
  preferredLocale: string
}

interface DiveCenterProfile {
  name: string
  city: string
  country: string
  contactEmail: string
  contactPhone: string
  associations: { agency: string; number: string }[]
  focusedLanguages: string[]
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
  city: string
  country: string
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
  focusedLanguages: string[]
  verified: boolean
}

interface PoolProfile {
  name: string
  city: string
  country: string
  contactEmail: string
  contactPhone: string
  maxDepth: number
  maxCapacity: number
  focusedLanguages: string[]
  verified: boolean
}

interface EquipmentProfile {
  name: string
  city: string
  country: string
  contactEmail: string
  contactPhone: string
  focusedLanguages: string[]
  manufacturersByGearType?: Record<string, string[]>
  verified: boolean
}

interface CompressorProfile {
  name: string
  city: string
  country: string
  contactEmail: string
  contactPhone: string
  gasMixes?: GasMixType[]
  focusedLanguages: string[]
  verified: boolean
}

interface AgentProfile {
  name: string
  locations: { city: string; country: string }[]
  contactEmail: string
  contactPhone: string
  associations: { agency: string; number: string }[]
  focusedLanguages: string[]
  defaultReferralMode: 'independent' | 'referral'
  verified: boolean
}

interface InstructorProfile {
  name: string
  city: string
  country: string
  contactEmail: string
  contactPhone: string
  credential: {
    agency: string
    level: string
    agencyID: string
    courses: string[]
  }[]
  languages: string[]
  verified: boolean
}

export interface SeedStakeholder {
  user: SeedUser
  diveCenter?: DiveCenterProfile
  boat?: BoatProfile
  pool?: PoolProfile
  equipment?: EquipmentProfile
  compressor?: CompressorProfile
  agent?: AgentProfile
  instructor?: InstructorProfile
}

// ── Route Helpers ───────────────────────────────────────────────────

const RACHA = 'Racha Noi / Racha Yai'
const SHARK_KC = 'Shark Point / King Cruiser'
const PHI_PHI = 'Phi Phi'
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0] // Mon–Sun

// ── 1. Compressor Shop Chalong Pier ─────────────────────────────────

export const COMPRESSOR: SeedStakeholder = {
  user: {
    slug: 'compressor-chalong',
    email: 'compressor-chalong+clerk_test@divedispatch.dev',
    name: 'Compressor Shop Chalong Pier',
    firstName: 'Chalong',
    lastName: 'Compressor',
    businessName: 'Compressor Shop Chalong Pier',
    role: 'Compressor',
    preferredLocale: LOCALE,
  },
  compressor: {
    name: 'Compressor Shop Chalong Pier',
    ...PHUKET,
    contactEmail: 'compressor-chalong@divedispatch.dev',
    contactPhone: '+66-76-381-001',
    focusedLanguages: ['Thai', 'English'],
    verified: VERIFIED,
  },
}

// ── 2. Hug Ocean (DC + Boat + Pool + Equipment) ────────────────────

export const HUG_OCEAN: SeedStakeholder = {
  user: {
    slug: 'hug-ocean',
    email: 'hug-ocean+clerk_test@divedispatch.dev',
    name: 'Hug Ocean',
    firstName: 'Hug',
    lastName: 'Ocean',
    businessName: 'Hug Ocean',
    role: 'DiveCenter',
    additionalRoles: ['Boat', 'Pool', 'Equipment'],
    preferredLocale: LOCALE,
  },
  diveCenter: {
    name: 'Hug Ocean',
    ...PHUKET,
    contactEmail: 'hug-ocean@divedispatch.dev',
    contactPhone: '+66-76-381-100',
    associations: [{ agency: 'PADI', number: 'S-34782' }],
    focusedLanguages: ['Mandarin', 'Thai'],
    verified: VERIFIED,
    bookingPreferences: ALL_DC_BOOKING_PREFS,
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
    focusedLanguages: ['Mandarin', 'Thai'],
    verified: VERIFIED,
  },
  pool: {
    name: 'Hug Ocean',
    ...PHUKET,
    contactEmail: 'hug-ocean@divedispatch.dev',
    contactPhone: '+66-76-381-102',
    maxDepth: 3,
    maxCapacity: 15,
    focusedLanguages: ['Mandarin', 'Thai'],
    verified: VERIFIED,
  },
  equipment: {
    name: 'Hug Ocean',
    ...PHUKET,
    contactEmail: 'hug-ocean@divedispatch.dev',
    contactPhone: '+66-76-381-103',
    focusedLanguages: ['Mandarin', 'Thai'],
    manufacturersByGearType: { wetsuit: ['ScubaPro'], bcd: ['ScubaPro'] },
    verified: VERIFIED,
  },
}

// ── 3. Water Pro (Pool) ─────────────────────────────────────────────

export const WATER_PRO: SeedStakeholder = {
  user: {
    slug: 'water-pro',
    email: 'water-pro+clerk_test@divedispatch.dev',
    name: 'Water Pro',
    firstName: 'Water',
    lastName: 'Pro',
    businessName: 'Water Pro',
    role: 'Pool',
    preferredLocale: LOCALE,
  },
  pool: {
    name: 'Water Pro',
    ...PHUKET,
    contactEmail: 'water-pro@divedispatch.dev',
    contactPhone: '+66-76-382-001',
    maxDepth: 3,
    maxCapacity: 25,
    focusedLanguages: ['Thai', 'English'],
    verified: VERIFIED,
  },
}

// ── 4. Neptune (DC + Pool + Equipment) ──────────────────────────────

export const NEPTUNE: SeedStakeholder = {
  user: {
    slug: 'neptune',
    email: 'neptune+clerk_test@divedispatch.dev',
    name: 'Neptune',
    firstName: 'Neptune',
    lastName: 'Dive',
    businessName: 'Neptune',
    role: 'DiveCenter',
    additionalRoles: ['Pool', 'Equipment'],
    preferredLocale: LOCALE,
  },
  diveCenter: {
    name: 'Neptune',
    ...PHUKET,
    contactEmail: 'neptune@divedispatch.dev',
    contactPhone: '+66-76-383-001',
    associations: [{ agency: 'PADI', number: 'S-41256' }],
    focusedLanguages: ['Mandarin'],
    verified: VERIFIED,
    bookingPreferences: ALL_DC_BOOKING_PREFS,
  },
  pool: {
    name: 'Neptune',
    ...PHUKET,
    contactEmail: 'neptune@divedispatch.dev',
    contactPhone: '+66-76-383-002',
    maxDepth: 2.5,
    maxCapacity: 6,
    focusedLanguages: ['Mandarin'],
    verified: VERIFIED,
  },
  equipment: {
    name: 'Neptune',
    ...PHUKET,
    contactEmail: 'neptune@divedispatch.dev',
    contactPhone: '+66-76-383-003',
    focusedLanguages: ['Mandarin'],
    manufacturersByGearType: { wetsuit: ['Aqua Lung'], bcd: ['Aqua Lung'] },
    verified: VERIFIED,
  },
}

// ── 5. Shark Bites (Pool) ───────────────────────────────────────────

export const SHARK_BITES: SeedStakeholder = {
  user: {
    slug: 'shark-bites',
    email: 'shark-bites+clerk_test@divedispatch.dev',
    name: 'Shark Bites',
    firstName: 'Shark',
    lastName: 'Bites',
    businessName: 'Shark Bites',
    role: 'Pool',
    preferredLocale: LOCALE,
  },
  pool: {
    name: 'Shark Bites',
    ...PHUKET,
    contactEmail: 'shark-bites@divedispatch.dev',
    contactPhone: '+66-76-384-001',
    maxDepth: 2.5,
    maxCapacity: 8,
    focusedLanguages: ['Thai', 'English'],
    verified: VERIFIED,
  },
}

// ── 6. Phuket Dive Center (DC + Boat + Equipment) ──────────────────

export const PHUKET_DC: SeedStakeholder = {
  user: {
    slug: 'phuket-dive-center',
    email: 'phuket-dive-center+clerk_test@divedispatch.dev',
    name: 'Phuket Dive Center',
    firstName: 'Phuket',
    lastName: 'Dive Center',
    businessName: 'Phuket Dive Center',
    role: 'DiveCenter',
    additionalRoles: ['Boat', 'Equipment'],
    preferredLocale: LOCALE,
  },
  diveCenter: {
    name: 'Phuket Dive Center',
    ...PHUKET,
    contactEmail: 'phuket-dive-center@divedispatch.dev',
    contactPhone: '+66-76-385-001',
    associations: [{ agency: 'PADI', number: 'S-29815' }],
    focusedLanguages: ['English', 'Thai', 'Chinese'],
    verified: VERIFIED,
    bookingPreferences: ALL_DC_BOOKING_PREFS,
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
    focusedLanguages: ['English', 'Thai', 'Chinese'],
    verified: VERIFIED,
  },
  equipment: {
    name: 'Phuket Dive Center',
    ...PHUKET,
    contactEmail: 'phuket-dive-center@divedispatch.dev',
    contactPhone: '+66-76-385-003',
    focusedLanguages: ['English', 'Thai', 'Chinese'],
    manufacturersByGearType: { wetsuit: ['Mares'], bcd: ['Mares'] },
    verified: VERIFIED,
  },
}

// ── 7. Nicole Dive Center (DC + Equipment) ──────────────────────────

export const NICOLE_DC: SeedStakeholder = {
  user: {
    slug: 'nicole-dive-center',
    email: 'nicole-dive-center+clerk_test@divedispatch.dev',
    name: 'Nicole Dive Center',
    firstName: 'Nicole',
    lastName: 'Dive Center',
    businessName: 'Nicole Dive Center',
    role: 'DiveCenter',
    additionalRoles: ['Equipment'],
    preferredLocale: LOCALE,
  },
  diveCenter: {
    name: 'Nicole Dive Center',
    ...PHUKET,
    contactEmail: 'nicole-dive-center@divedispatch.dev',
    contactPhone: '+66-76-386-001',
    associations: [{ agency: 'PADI', number: 'S-55198' }],
    focusedLanguages: ['English', 'Cantonese'],
    verified: VERIFIED,
    bookingPreferences: ALL_DC_BOOKING_PREFS,
  },
  equipment: {
    name: 'Nicole Dive Center',
    ...PHUKET,
    contactEmail: 'nicole-dive-center@divedispatch.dev',
    contactPhone: '+66-76-386-002',
    focusedLanguages: ['English', 'Cantonese'],
    manufacturersByGearType: {
      wetsuit: ['ScubaPro', 'Aqua Lung', 'Mares'],
      bcd: ['ScubaPro', 'Aqua Lung', 'Mares'],
    },
    verified: VERIFIED,
  },
}

// ── 8. Manta Dive Center (DC only) ─────────────────────────────────

export const MANTA_DC: SeedStakeholder = {
  user: {
    slug: 'manta-dive-center',
    email: 'manta-dive-center+clerk_test@divedispatch.dev',
    name: 'Manta Dive Center',
    firstName: 'Manta',
    lastName: 'Dive Center',
    businessName: 'Manta Dive Center',
    role: 'DiveCenter',
    preferredLocale: LOCALE,
  },
  diveCenter: {
    name: 'Manta Dive Center',
    ...PHUKET,
    contactEmail: 'manta-dive-center@divedispatch.dev',
    contactPhone: '+66-76-387-001',
    associations: [{ agency: 'SSI', number: 'DC-80234' }],
    focusedLanguages: ['English', 'French'],
    verified: VERIFIED,
    bookingPreferences: ALL_DC_BOOKING_PREFS,
  },
}

// ── 9. ScubaNicks (DC + Equipment) ──────────────────────────────────

export const SCUBANICKS: SeedStakeholder = {
  user: {
    slug: 'scubanicks',
    email: 'scubanicks+clerk_test@divedispatch.dev',
    name: 'ScubaNicks',
    firstName: 'Nick',
    lastName: 'ScubaNicks',
    businessName: 'ScubaNicks',
    role: 'DiveCenter',
    additionalRoles: ['Equipment'],
    preferredLocale: LOCALE,
  },
  diveCenter: {
    name: 'ScubaNicks',
    ...PHUKET,
    contactEmail: 'scubanicks@divedispatch.dev',
    contactPhone: '+66-76-388-001',
    associations: [{ agency: 'SSI', number: 'DC-91547' }],
    focusedLanguages: ['English'],
    verified: VERIFIED,
    bookingPreferences: ALL_DC_BOOKING_PREFS,
  },
  equipment: {
    name: 'ScubaNicks',
    ...PHUKET,
    contactEmail: 'scubanicks@divedispatch.dev',
    contactPhone: '+66-76-388-002',
    focusedLanguages: ['English'],
    manufacturersByGearType: { wetsuit: ['ScubaPro'], bcd: ['ScubaPro'] },
    verified: VERIFIED,
  },
}

// ── 10. Scuba Deep (DC + Boat + Equipment) ──────────────────────────

export const SCUBA_DEEP: SeedStakeholder = {
  user: {
    slug: 'scuba-deep',
    email: 'scuba-deep+clerk_test@divedispatch.dev',
    name: 'Scuba Deep',
    firstName: 'Scuba',
    lastName: 'Deep',
    businessName: 'Scuba Deep',
    role: 'DiveCenter',
    additionalRoles: ['Boat', 'Equipment'],
    preferredLocale: LOCALE,
  },
  diveCenter: {
    name: 'Scuba Deep',
    ...PHUKET,
    contactEmail: 'scuba-deep@divedispatch.dev',
    contactPhone: '+66-76-389-001',
    associations: [
      { agency: 'SSI', number: 'DC-72019' },
      { agency: 'PADI', number: 'S-61834' },
    ],
    focusedLanguages: ['English'],
    verified: VERIFIED,
    bookingPreferences: ALL_DC_BOOKING_PREFS,
  },
  boat: {
    name: 'Scuba Deep',
    ...PHUKET,
    contactEmail: 'scuba-deep@divedispatch.dev',
    contactPhone: '+66-76-389-002',
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
    focusedLanguages: ['English'],
    verified: VERIFIED,
  },
  equipment: {
    name: 'Scuba Deep',
    ...PHUKET,
    contactEmail: 'scuba-deep@divedispatch.dev',
    contactPhone: '+66-76-389-003',
    focusedLanguages: ['English'],
    manufacturersByGearType: { wetsuit: ['Mares'], bcd: ['Mares'] },
    verified: VERIFIED,
  },
}

// ── 11. Pray Dive Center (DC only) ─────────────────────────────────

export const PRAY_DC: SeedStakeholder = {
  user: {
    slug: 'pray-dive-center',
    email: 'pray-dive-center+clerk_test@divedispatch.dev',
    name: 'Pray Dive Center',
    firstName: 'Pray',
    lastName: 'Dive Center',
    businessName: 'Pray Dive Center',
    role: 'DiveCenter',
    preferredLocale: LOCALE,
  },
  diveCenter: {
    name: 'Pray Dive Center',
    ...PHUKET,
    contactEmail: 'pray-dive-center@divedispatch.dev',
    contactPhone: '+66-76-390-001',
    associations: [{ agency: 'PADI', number: 'S-48203' }],
    focusedLanguages: ['German', 'French', 'Thai', 'English'],
    verified: VERIFIED,
    bookingPreferences: ALL_DC_BOOKING_PREFS,
  },
}

// ── 12. Amanda (Agent) ──────────────────────────────────────────────

export const AMANDA: SeedStakeholder = {
  user: {
    slug: 'amanda',
    email: 'amanda+clerk_test@divedispatch.dev',
    name: 'Amanda',
    firstName: 'Amanda',
    lastName: 'Chen',
    businessName: 'Amanda',
    role: 'Agent',
    preferredLocale: LOCALE,
  },
  agent: {
    name: 'Amanda',
    locations: [{ city: 'Phuket', country: 'Thailand' }],
    contactEmail: 'amanda@divedispatch.dev',
    contactPhone: '+66-81-555-0012',
    associations: [{ agency: 'PADI', number: 'A-10482' }],
    focusedLanguages: ['Chinese'],
    defaultReferralMode: 'independent',
    verified: VERIFIED,
  },
}

// ── All Non-Instructor Stakeholders ─────────────────────────────────

export const ALL_STAKEHOLDERS: SeedStakeholder[] = [
  COMPRESSOR,
  HUG_OCEAN,
  WATER_PRO,
  NEPTUNE,
  SHARK_BITES,
  PHUKET_DC,
  NICOLE_DC,
  MANTA_DC,
  SCUBANICKS,
  SCUBA_DEEP,
  PRAY_DC,
  AMANDA,
]
