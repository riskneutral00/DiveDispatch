// Seed data constants for all stakeholders.
// Consumed by convex/seed.ts internal mutations.

// ── Shared Defaults ─────────────────────────────────────────────────

const PHUKET = { city: 'Phuket', country: 'Thailand' } as const
const VERIFIED = true
const LOCALE = 'en'
const BOOKING_DAYS = { owDays: 3, aowDays: 2, oaDays: 4 }

// Each DC has unique AOW specialty preferences (5 required for AOW's 5 adventure dives)
const DC_BOOKING_PREFS = {
  hugOcean:   { ...BOOKING_DAYS, aowSpecialties: ['Deep', 'Drift', 'Night', 'Peak Performance Buoyancy', 'Wreck'] },
  neptune:    { ...BOOKING_DAYS, aowSpecialties: ['Deep', 'Drift', 'Fish ID', 'Peak Performance Buoyancy', 'Underwater Navigation'] },
  phuketDC:   { ...BOOKING_DAYS, aowSpecialties: ['Deep', 'Drift', 'Peak Performance Buoyancy', 'Underwater Navigation', 'Wreck'] },
  nicoleDC:   { ...BOOKING_DAYS, aowSpecialties: ['Boat', 'Deep', 'Drift', 'Peak Performance Buoyancy', 'Wreck'] },
  mantaDC:    { ...BOOKING_DAYS, aowSpecialties: ['Deep', 'Drift', 'Night', 'Search & Recovery', 'Wreck'] },
  scubaNicks: { ...BOOKING_DAYS, aowSpecialties: ['Deep', 'Drift', 'Naturalist', 'Peak Performance Buoyancy', 'Wreck'] },
  scubaDeep:  { ...BOOKING_DAYS, aowSpecialties: ['Deep', 'Drift', 'Peak Performance Buoyancy', 'Underwater Navigation', 'Wreck'] },
  prayDC:     { ...BOOKING_DAYS, aowSpecialties: ['Deep', 'Drift', 'Night', 'Peak Performance Buoyancy', 'Underwater Navigation'] },
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
  hasCompressor: boolean
  verified: boolean
}

interface VenueProfile {
  name: string
  city: string
  country: string
  contactEmail: string
  contactPhone: string
  focusedLanguages: string[]
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
  pool?: VenueProfile
  equipment?: EquipmentProfile
  compressor?: CompressorProfile
  agent?: AgentProfile
  instructor?: InstructorProfile
}

/** Unowned dive sites — public locations seeded without user accounts. */
export interface SeedDiveSite {
  name: string
  slug: string
  capacity: number
}

// ── Route Helpers ───────────────────────────────────────────────────

const RACHA = 'Racha Noi / Racha Yai'
const SHARK_KC = 'Shark Point / King Cruiser'
const PHI_PHI = 'Phi Phi'
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0] // Mon–Sun

// ── 1. Compressor Shop Chalong Pier ─────────────────────────────────

export const COMPRESSOR: SeedStakeholder = {
  user: {
    slug: 'x4kp2m',
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

// ── 2. Hug Ocean (DC) ───────────────────────────────────────────────

export const HUG_OCEAN: SeedStakeholder = {
  user: {
    slug: 'n7rq5j',
    email: 'hug-ocean+clerk_test@divedispatch.dev',
    name: 'Hug Ocean',
    firstName: 'Hug',
    lastName: 'Ocean',
    businessName: 'Hug Ocean',
    role: 'DiveCenter',
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
    bookingPreferences: DC_BOOKING_PREFS.hugOcean,
  },
}

// ── 2a. Hug Ocean Boat ──────────────────────────────────────────────

export const HUG_OCEAN_BOAT: SeedStakeholder = {
  user: {
    slug: 'n7rq5j-bt',
    email: 'hug-ocean-boat+clerk_test@divedispatch.dev',
    name: 'Hug Ocean Boat',
    firstName: 'Hug',
    lastName: 'Ocean Boat',
    businessName: 'Hug Ocean Boat',
    role: 'Boat',
    preferredLocale: LOCALE,
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
    hasCompressor: false,
    verified: VERIFIED,
  },
}

// ── 2b. Hug Ocean Pool ──────────────────────────────────────────────

export const HUG_OCEAN_POOL: SeedStakeholder = {
  user: {
    slug: 'n7rq5j-pl',
    email: 'hug-ocean-pool+clerk_test@divedispatch.dev',
    name: 'Hug Ocean Pool',
    firstName: 'Hug',
    lastName: 'Ocean Pool',
    businessName: 'Hug Ocean Pool',
    role: 'Pool',
    preferredLocale: LOCALE,
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
    venueType: 'Pool',
    isPublic: false,
    confinedCapable: true,
    openWaterCapable: false,
    hasCompressor: false,
  },
}

// ── 2c. Hug Ocean Equipment ─────────────────────────────────────────

export const HUG_OCEAN_EQUIPMENT: SeedStakeholder = {
  user: {
    slug: 'n7rq5j-eq',
    email: 'hug-ocean-equipment+clerk_test@divedispatch.dev',
    name: 'Hug Ocean Equipment',
    firstName: 'Hug',
    lastName: 'Ocean Equipment',
    businessName: 'Hug Ocean Equipment',
    role: 'Equipment',
    preferredLocale: LOCALE,
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
    slug: 'b3wt9f',
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
    venueType: 'Pool',
    isPublic: false,
    confinedCapable: true,
    openWaterCapable: false,
    hasCompressor: false,
  },
}

// ── 4. Neptune (DC) ─────────────────────────────────────────────────

export const NEPTUNE: SeedStakeholder = {
  user: {
    slug: 'z8mv4c',
    email: 'neptune+clerk_test@divedispatch.dev',
    name: 'Neptune',
    firstName: 'Neptune',
    lastName: 'Dive',
    businessName: 'Neptune',
    role: 'DiveCenter',
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
    bookingPreferences: DC_BOOKING_PREFS.neptune,
  },
}

// ── 4a. Neptune Pool ────────────────────────────────────────────────

export const NEPTUNE_POOL: SeedStakeholder = {
  user: {
    slug: 'z8mv4c-pl',
    email: 'neptune-pool+clerk_test@divedispatch.dev',
    name: 'Neptune Pool',
    firstName: 'Neptune',
    lastName: 'Pool',
    businessName: 'Neptune Pool',
    role: 'Pool',
    preferredLocale: LOCALE,
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
    venueType: 'Pool',
    isPublic: false,
    confinedCapable: true,
    openWaterCapable: false,
    hasCompressor: false,
  },
}

// ── 4b. Neptune Equipment ───────────────────────────────────────────

export const NEPTUNE_EQUIPMENT: SeedStakeholder = {
  user: {
    slug: 'z8mv4c-eq',
    email: 'neptune-equipment+clerk_test@divedispatch.dev',
    name: 'Neptune Equipment',
    firstName: 'Neptune',
    lastName: 'Equipment',
    businessName: 'Neptune Equipment',
    role: 'Equipment',
    preferredLocale: LOCALE,
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
    slug: 'g2hn6x',
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
    venueType: 'Pool',
    isPublic: false,
    confinedCapable: true,
    openWaterCapable: false,
    hasCompressor: false,
  },
}

// ── 6. Phuket Dive Center (DC) ──────────────────────────────────────

export const PHUKET_DC: SeedStakeholder = {
  user: {
    slug: 'p5ky3w',
    email: 'phuket-dive-center+clerk_test@divedispatch.dev',
    name: 'Phuket Dive Center',
    firstName: 'Phuket',
    lastName: 'Dive Center',
    businessName: 'Phuket Dive Center',
    role: 'DiveCenter',
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
    bookingPreferences: DC_BOOKING_PREFS.phuketDC,
  },
}

// ── 6a. Phuket DC Boat ─────────────────────────────────────────────

export const PHUKET_DC_BOAT: SeedStakeholder = {
  user: {
    slug: 'p5ky3w-bt',
    email: 'phuket-dc-boat+clerk_test@divedispatch.dev',
    name: 'Phuket DC Boat',
    firstName: 'Phuket',
    lastName: 'DC Boat',
    businessName: 'Phuket DC Boat',
    role: 'Boat',
    preferredLocale: LOCALE,
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
    hasCompressor: false,
    verified: VERIFIED,
  },
}

// ── 6b. Phuket DC Equipment ────────────────────────────────────────

export const PHUKET_DC_EQUIPMENT: SeedStakeholder = {
  user: {
    slug: 'p5ky3w-eq',
    email: 'phuket-dc-equipment+clerk_test@divedispatch.dev',
    name: 'Phuket DC Equipment',
    firstName: 'Phuket',
    lastName: 'DC Equipment',
    businessName: 'Phuket DC Equipment',
    role: 'Equipment',
    preferredLocale: LOCALE,
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

// ── 7. Nicole Dive Center (DC) ──────────────────────────────────────

export const NICOLE_DC: SeedStakeholder = {
  user: {
    slug: 'q9bz7r',
    email: 'nicole-dive-center+clerk_test@divedispatch.dev',
    name: 'Nicole Dive Center',
    firstName: 'Nicole',
    lastName: 'Dive Center',
    businessName: 'Nicole Dive Center',
    role: 'DiveCenter',
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
    bookingPreferences: DC_BOOKING_PREFS.nicoleDC,
  },
}

// ── 7a. Nicole DC Equipment ─────────────────────────────────────────

export const NICOLE_DC_EQUIPMENT: SeedStakeholder = {
  user: {
    slug: 'q9bz7r-eq',
    email: 'nicole-dc-equipment+clerk_test@divedispatch.dev',
    name: 'Nicole DC Equipment',
    firstName: 'Nicole',
    lastName: 'DC Equipment',
    businessName: 'Nicole DC Equipment',
    role: 'Equipment',
    preferredLocale: LOCALE,
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
    slug: 'v6js2t',
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
    bookingPreferences: DC_BOOKING_PREFS.mantaDC,
  },
}

// ── 9. ScubaNicks (DC) ──────────────────────────────────────────────

export const SCUBANICKS: SeedStakeholder = {
  user: {
    slug: 'm4fx8d',
    email: 'scubanicks+clerk_test@divedispatch.dev',
    name: 'ScubaNicks',
    firstName: 'Nick',
    lastName: 'ScubaNicks',
    businessName: 'ScubaNicks',
    role: 'DiveCenter',
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
    bookingPreferences: DC_BOOKING_PREFS.scubaNicks,
  },
}

// ── 9a. ScubaNicks Equipment ────────────────────────────────────────

export const SCUBANICKS_EQUIPMENT: SeedStakeholder = {
  user: {
    slug: 'm4fx8d-eq',
    email: 'scubanicks-equipment+clerk_test@divedispatch.dev',
    name: 'ScubaNicks Equipment',
    firstName: 'Nick',
    lastName: 'ScubaNicks Equipment',
    businessName: 'ScubaNicks Equipment',
    role: 'Equipment',
    preferredLocale: LOCALE,
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

// ── 10. Scuba Deep (DC) ─────────────────────────────────────────────

export const SCUBA_DEEP: SeedStakeholder = {
  user: {
    slug: 'h3cp6n',
    email: 'scuba-deep+clerk_test@divedispatch.dev',
    name: 'Scuba Deep',
    firstName: 'Scuba',
    lastName: 'Deep',
    businessName: 'Scuba Deep',
    role: 'DiveCenter',
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
    bookingPreferences: DC_BOOKING_PREFS.scubaDeep,
  },
}

// ── 10a. Scuba Deep Boat ────────────────────────────────────────────

export const SCUBA_DEEP_BOAT: SeedStakeholder = {
  user: {
    slug: 'h3cp6n-bt',
    email: 'scuba-deep-boat+clerk_test@divedispatch.dev',
    name: 'Scuba Deep Boat',
    firstName: 'Scuba',
    lastName: 'Deep Boat',
    businessName: 'Scuba Deep Boat',
    role: 'Boat',
    preferredLocale: LOCALE,
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
    hasCompressor: false,
    verified: VERIFIED,
  },
}

// ── 10b. Scuba Deep Equipment ───────────────────────────────────────

export const SCUBA_DEEP_EQUIPMENT: SeedStakeholder = {
  user: {
    slug: 'h3cp6n-eq',
    email: 'scuba-deep-equipment+clerk_test@divedispatch.dev',
    name: 'Scuba Deep Equipment',
    firstName: 'Scuba',
    lastName: 'Deep Equipment',
    businessName: 'Scuba Deep Equipment',
    role: 'Equipment',
    preferredLocale: LOCALE,
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
    slug: 't7gw1k',
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
    bookingPreferences: DC_BOOKING_PREFS.prayDC,
  },
}

// ── 12. Amanda (Agent) ──────────────────────────────────────────────

export const AMANDA: SeedStakeholder = {
  user: {
    slug: 'r5yz4q',
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

// ── Unowned Dive Sites (no user account) ────────────────────────────

export const UNOWNED_DIVE_SITES: SeedDiveSite[] = [
  { name: 'Kata Beach', slug: 'kata-beach', capacity: 50 },
]

// ── All Non-Instructor Stakeholders ─────────────────────────────────

export const ALL_STAKEHOLDERS: SeedStakeholder[] = [
  COMPRESSOR,
  HUG_OCEAN,
  HUG_OCEAN_BOAT,
  HUG_OCEAN_POOL,
  HUG_OCEAN_EQUIPMENT,
  WATER_PRO,
  NEPTUNE,
  NEPTUNE_POOL,
  NEPTUNE_EQUIPMENT,
  SHARK_BITES,
  PHUKET_DC,
  PHUKET_DC_BOAT,
  PHUKET_DC_EQUIPMENT,
  NICOLE_DC,
  NICOLE_DC_EQUIPMENT,
  MANTA_DC,
  SCUBANICKS,
  SCUBANICKS_EQUIPMENT,
  SCUBA_DEEP,
  SCUBA_DEEP_BOAT,
  SCUBA_DEEP_EQUIPMENT,
  PRAY_DC,
  AMANDA,
]

// ── Hierarchy Links (DC → managed resources) ───────────────────────

export const HIERARCHY_LINKS: { parentSlug: string; parentType: StakeholderRole; childSlug: string; childType: StakeholderRole }[] = [
  // Hug Ocean owns Boat, Pool, Equipment
  { parentSlug: 'n7rq5j', parentType: 'DiveCenter', childSlug: 'n7rq5j-bt', childType: 'Boat' },
  { parentSlug: 'n7rq5j', parentType: 'DiveCenter', childSlug: 'n7rq5j-pl', childType: 'Pool' },
  { parentSlug: 'n7rq5j', parentType: 'DiveCenter', childSlug: 'n7rq5j-eq', childType: 'Equipment' },
  // Neptune owns Pool, Equipment
  { parentSlug: 'z8mv4c', parentType: 'DiveCenter', childSlug: 'z8mv4c-pl', childType: 'Pool' },
  { parentSlug: 'z8mv4c', parentType: 'DiveCenter', childSlug: 'z8mv4c-eq', childType: 'Equipment' },
  // Phuket DC owns Boat, Equipment
  { parentSlug: 'p5ky3w', parentType: 'DiveCenter', childSlug: 'p5ky3w-bt', childType: 'Boat' },
  { parentSlug: 'p5ky3w', parentType: 'DiveCenter', childSlug: 'p5ky3w-eq', childType: 'Equipment' },
  // Nicole DC owns Equipment
  { parentSlug: 'q9bz7r', parentType: 'DiveCenter', childSlug: 'q9bz7r-eq', childType: 'Equipment' },
  // ScubaNicks owns Equipment
  { parentSlug: 'm4fx8d', parentType: 'DiveCenter', childSlug: 'm4fx8d-eq', childType: 'Equipment' },
  // Scuba Deep owns Boat, Equipment
  { parentSlug: 'h3cp6n', parentType: 'DiveCenter', childSlug: 'h3cp6n-bt', childType: 'Boat' },
  { parentSlug: 'h3cp6n', parentType: 'DiveCenter', childSlug: 'h3cp6n-eq', childType: 'Equipment' },
]
