import type { StakeholderRole } from './lib/validators'
import {
  SCUBAPRO_WETSUITS, SCUBAPRO_BCDS,
  AQUALUNG_WETSUITS, AQUALUNG_BCDS,
  MARES_WETSUITS, MARES_BCDS,
} from './shared/gearSizing'
export type { StakeholderRole }

export const PHUKET = { placeName: 'Phuket', country: 'Thailand', lat: 7.8804, lng: 98.3923 } as const
const CHALONG = { placeName: 'Phuket', country: 'Thailand', lat: 7.8386, lng: 98.3519 } as const
const KATA = { placeName: 'Phuket', country: 'Thailand', lat: 7.8202, lng: 98.3062 } as const
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
  email: string
  phone: string
  verified: boolean
  venueCategory: 'pool' | 'diveSite'
  diveSiteTypes?: Array<'shore' | 'reef' | 'lake' | 'river' | 'quarry' | 'other'>
  confinedCapable?: boolean
  hasCompressor: boolean
  maxDepth?: number
  maxCapacity?: number
}

export interface SeedInventoryLine {
  gearType: 'wetsuit' | 'bcd' | 'fins' | 'mask' | 'regulator'
  manufacturer?: string
  size?: string
  diopter?: number
  isPrescription?: boolean
  totalUnits: number
  displayName: string
}

interface EquipmentProfile {
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
  email: string
  phone: string
  manufacturersByGearType?: Record<string, string[]>
  inventoryOverrides?: SeedInventoryLine[]
  isAllowed?: string[]
  notAllowed?: string[]
  verified: boolean
}

interface CompressorProfile {
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
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
  email: string
  phone: string
  associations: { agency: string; number: string }[]
  defaultReferral?: string
  verified: boolean
}

interface InstructorProfile {
  name: string
  placeName: string
  country: string
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

export interface SeedDiveSite {
  name: string
  slug: string
  capacity: number
}

function buildNicoleInventoryOverrides(): SeedInventoryLine[] {
  const lines: SeedInventoryLine[] = []

  const wetsuitBrands = [
    { name: 'ScubaPro', sizes: SCUBAPRO_WETSUITS },
    { name: 'Aqua Lung', sizes: AQUALUNG_WETSUITS },
    { name: 'Mares', sizes: MARES_WETSUITS },
  ]
  for (const { name, sizes } of wetsuitBrands) {
    for (const entry of sizes) {
      lines.push({ gearType: 'wetsuit', manufacturer: name, size: entry.size, totalUnits: 5, displayName: `${name} Wetsuit ${entry.size}` })
    }
  }

  const bcdBrands = [
    { name: 'ScubaPro', sizes: SCUBAPRO_BCDS },
    { name: 'Aqua Lung', sizes: AQUALUNG_BCDS },
    { name: 'Mares', sizes: MARES_BCDS },
  ]
  for (const { name, sizes } of bcdBrands) {
    for (const entry of sizes) {
      lines.push({ gearType: 'bcd', manufacturer: name, size: entry.size, totalUnits: 6, displayName: `${name} BCD ${entry.size}` })
    }
  }

  for (let eu = 38; eu <= 47.5; eu += 0.5) {
    const label = `EU ${eu}`
    lines.push({ gearType: 'fins', size: label, totalUnits: 5, displayName: `Fins ${label}` })
  }

  lines.push({ gearType: 'mask', isPrescription: false, totalUnits: 10, displayName: 'Mask + Snorkel (Regular)' })
  for (let d = -2.0; d >= -6.0; d -= 0.5) {
    lines.push({ gearType: 'mask', diopter: d, isPrescription: true, totalUnits: 2, displayName: `Mask (Rx ${d})` })
  }

  lines.push({ gearType: 'regulator', manufacturer: 'ScubaPro', totalUnits: 20, displayName: 'ScubaPro Regulator Set' })
  lines.push({ gearType: 'regulator', manufacturer: 'Aqua Lung', totalUnits: 20, displayName: 'Aqua Lung Regulator Set' })
  lines.push({ gearType: 'regulator', manufacturer: 'Mares', totalUnits: 20, displayName: 'Mares Regulator Set' })

  return lines
}

const RACHA = 'Racha Noi / Racha Yai'
const SHARK_KC = 'Shark Point / King Cruiser'
const PHI_PHI = 'Phi Phi'
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0] // Mon-Sun

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
    venueCategory: 'pool',

    hasCompressor: false,
  },
  equipment: {
    name: 'Hug Ocean',
    ...PHUKET,
    email: 'hug-ocean@divedispatch.dev',
    phone: '+66-76-381-103',
    manufacturersByGearType: { wetsuit: ['ScubaPro'], bcd: ['ScubaPro'] },
    isAllowed: ['n7rq5j'],
    verified: VERIFIED,
  },
}

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
    venueCategory: 'pool',

    hasCompressor: false,
  },
  equipment: {
    name: 'Neptune',
    ...PHUKET,
    email: 'neptune@divedispatch.dev',
    phone: '+66-76-383-003',
    manufacturersByGearType: { wetsuit: ['Aqua Lung'], bcd: ['Aqua Lung'] },
    isAllowed: ['z8mv4c'],
    verified: VERIFIED,
  },
}

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
    name: 'Mandarin Queen',
    ...PHUKET,
    email: 'phuket-dive-center@divedispatch.dev',
    phone: '+66-76-385-002',
    fleet: [
      {
        boatName: 'M.V. Mandarin Queen 5',
        maxPax: 70,
        boatType: 'day_boat',
        routes: [
          { diveSite: RACHA, daysOfWeek: [1, 4, 6] },
          { diveSite: SHARK_KC, daysOfWeek: [2] },
          { diveSite: PHI_PHI, daysOfWeek: [3, 5, 0] },
        ],
      },
      {
        boatName: 'M.V. Mandarin Queen 7',
        maxPax: 90,
        boatType: 'day_boat',
        routes: [
          { diveSite: RACHA, daysOfWeek: [2, 5, 0] },
          { diveSite: SHARK_KC, daysOfWeek: [3] },
          { diveSite: PHI_PHI, daysOfWeek: [1, 4, 6] },
        ],
      },
    ],
    hasCompressor: true,
    verified: VERIFIED,
  },
  equipment: {
    name: 'Phuket Dive Center',
    ...PHUKET,
    email: 'phuket-dive-center@divedispatch.dev',
    phone: '+66-76-385-003',
    manufacturersByGearType: { wetsuit: ['Mares'], bcd: ['Mares'] },
    isAllowed: ['p5ky3w'],
    verified: VERIFIED,
  },
}

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
    inventoryOverrides: buildNicoleInventoryOverrides(),
    verified: VERIFIED,
  },
}

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
    isAllowed: ['m4fx8d'],
    verified: VERIFIED,
  },
}

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
    isAllowed: ['h3cp6n'],
    verified: VERIFIED,
  },
}

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
    associations: [
      { agency: 'SSI', number: 'DC-70123', ...SSI_PREFS },
      { agency: 'PADI', number: 'S-70124', ...PADI_PREFS },
    ],
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
    hasCompressor: true,
    verified: VERIFIED,
  },
  equipment: {
    name: 'Sirolo',
    ...CHALONG,
    email: 'sirolo@divedispatch.dev',
    phone: '+66-76-391-003',
    manufacturersByGearType: { wetsuit: ['Mares'], bcd: ['Mares'] },
    isAllowed: ['sirolo'],
    verified: VERIFIED,
  },
}

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
    customerLanguages: ['en', 'th', 'fr', 'de'],
    verified: VERIFIED,
  },
}

export const HANUL_DIVE: SeedStakeholder = {
  user: {
    slug: 'w3kn7p',
    email: 'hanul-dive+clerk_test@divedispatch.dev',
    name: 'Park Joon-Woo',
    firstName: 'Joon-Woo',
    lastName: 'Park',
    businessName: 'Hanul Dive',
    appLanguage: 'ko',
    phone: '+66-81-234-5013',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Hanul Dive',
    ...PHUKET,
    email: 'hanul-dive@divedispatch.dev',
    phone: '+66-76-396-001',
    associations: [
      { agency: 'PADI', number: 'S-82301', ...PADI_PREFS },
      { agency: 'SSI', number: 'DC-82302', ...SSI_PREFS },
    ],
    customerLanguages: ['ko'],
    verified: VERIFIED,
  },
}

export const UMI_DIVE: SeedStakeholder = {
  user: {
    slug: 'b6um4j',
    email: 'umi-dive+clerk_test@divedispatch.dev',
    name: 'Tanaka Haruto',
    firstName: 'Haruto',
    lastName: 'Tanaka',
    businessName: 'Umi Dive Center',
    appLanguage: 'ja',
    phone: '+66-81-234-5015',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Umi Dive Center',
    ...PHUKET,
    email: 'umi-dive@divedispatch.dev',
    phone: '+66-76-396-002',
    associations: [
      { agency: 'PADI', number: 'S-83101', ...PADI_PREFS },
      { agency: 'SSI', number: 'DC-83102', ...SSI_PREFS },
    ],
    customerLanguages: ['ja'],
    verified: VERIFIED,
  },
}

export const AQUA_PRO: SeedStakeholder = {
  user: {
    slug: 'r9aq5v',
    email: 'aqua-pro+clerk_test@divedispatch.dev',
    name: 'Sergei Kozlov',
    firstName: 'Sergei',
    lastName: 'Kozlov',
    businessName: 'Aqua Pro Dive',
    appLanguage: 'ru',
    phone: '+66-81-234-5016',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Aqua Pro Dive',
    ...PHUKET,
    email: 'aqua-pro@divedispatch.dev',
    phone: '+66-76-396-003',
    associations: [
      { agency: 'PADI', number: 'S-84203', ...PADI_PREFS },
      { agency: 'SSI', number: 'DC-84204', ...SSI_PREFS },
    ],
    customerLanguages: ['ru'],
    verified: VERIFIED,
  },
}

export const PACIFIC_DIVERS: SeedStakeholder = {
  user: {
    slug: 'c2pd8x',
    email: 'pacific-divers+clerk_test@divedispatch.dev',
    name: 'Carlos Mendoza',
    firstName: 'Carlos',
    lastName: 'Mendoza',
    businessName: 'Pacific Divers',
    appLanguage: 'es',
    phone: '+66-81-234-5017',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Pacific Divers',
    ...PHUKET,
    email: 'pacific-divers@divedispatch.dev',
    phone: '+66-76-396-004',
    associations: [
      { agency: 'PADI', number: 'S-85104', ...PADI_PREFS },
      { agency: 'SSI', number: 'DC-85105', ...SSI_PREFS },
    ],
    customerLanguages: ['ko', 'ja', 'es'],
    verified: VERIFIED,
  },
}

export const BLUE_PLANET: SeedStakeholder = {
  user: {
    slug: 'f7bp3g',
    email: 'blue-planet+clerk_test@divedispatch.dev',
    name: 'Willem de Groot',
    firstName: 'Willem',
    lastName: 'de Groot',
    businessName: 'Blue Planet Diving',
    appLanguage: 'nl',
    phone: '+66-81-234-5018',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Blue Planet Diving',
    ...PHUKET,
    email: 'blue-planet@divedispatch.dev',
    phone: '+66-76-396-005',
    associations: [
      { agency: 'PADI', number: 'S-86200', ...PADI_PREFS },
      { agency: 'SSI', number: 'DC-86201', ...SSI_PREFS },
    ],
    customerLanguages: ['ru', 'id', 'nl'],
    verified: VERIFIED,
  },
}

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
    defaultReferral: 'q9bz7r',  // Nicole DC
    verified: VERIFIED,
  },
}

export const JIYEON_AGENT: SeedStakeholder = {
  user: {
    slug: 'k4ko9j',
    email: 'jiyeon+clerk_test@divedispatch.dev',
    name: 'Ji-Yeon Park',
    firstName: 'Ji-Yeon',
    lastName: 'Park',
    businessName: 'JY Dive Travel',
    appLanguage: 'ko',
    phone: '+82-10-3456-7890',
    customerLanguages: ['ko', 'en'],
  },
  roles: [{ role: 'Agent' }],
  agent: {
    name: 'JY Dive Travel',
    placeName: 'Seoul',
    country: 'South Korea',
    lat: 37.5665,
    lng: 126.9780,
    email: 'jiyeon@divedispatch.dev',
    phone: '+82-10-3456-7890',
    associations: [
      { agency: 'PADI', number: 'A-20501' },
      { agency: 'SSI', number: 'A-20502' },
    ],
    defaultReferral: 'w3kn7p',  // Hanul Dive
    verified: VERIFIED,
  },
}

export const KENJI_AGENT: SeedStakeholder = {
  user: {
    slug: 'a7ja2m',
    email: 'kenji+clerk_test@divedispatch.dev',
    name: 'Kenji Watanabe',
    firstName: 'Kenji',
    lastName: 'Watanabe',
    businessName: 'Watanabe Dive',
    appLanguage: 'ja',
    phone: '+81-90-1234-5678',
    customerLanguages: ['ja', 'en'],
  },
  roles: [{ role: 'Agent' }],
  agent: {
    name: 'Watanabe Dive',
    placeName: 'Tokyo',
    country: 'Japan',
    lat: 35.6762,
    lng: 139.6503,
    email: 'kenji@divedispatch.dev',
    phone: '+81-90-1234-5678',
    associations: [
      { agency: 'PADI', number: 'A-20503' },
      { agency: 'SSI', number: 'A-20504' },
    ],
    defaultReferral: 'b6um4j',  // Umi Dive
    verified: VERIFIED,
  },
}

export const EVA_AGENT: SeedStakeholder = {
  user: {
    slug: 'e6eu5z',
    email: 'eva+clerk_test@divedispatch.dev',
    name: 'Eva Klein',
    firstName: 'Eva',
    lastName: 'Klein',
    businessName: 'Klein Dive Europe',
    appLanguage: 'de',
    phone: '+49-170-1234567',
    customerLanguages: ['de', 'fr', 'nl'],
  },
  roles: [{ role: 'Agent' }],
  agent: {
    name: 'Klein Dive Europe',
    placeName: 'Berlin',
    country: 'Germany',
    lat: 52.5200,
    lng: 13.4050,
    email: 'eva@divedispatch.dev',
    phone: '+49-170-1234567',
    associations: [
      { agency: 'PADI', number: 'A-20505' },
      { agency: 'SSI', number: 'A-20506' },
    ],
    defaultReferral: 't7gw1k',  // Pray DC
    verified: VERIFIED,
  },
}

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

export const SCUBA_MARKET: SeedStakeholder = {
  user: {
    slug: 'q7sm3k',
    email: 'scuba-market+clerk_test@divedispatch.dev',
    name: 'Prawit Suksawat',
    firstName: 'Prawit',
    lastName: 'Suksawat',
    businessName: 'Scuba Market Thailand',
    appLanguage: 'th',
    phone: '+66-76-330-345',
  },
  roles: [{ role: 'Compressor' }],
  compressor: {
    name: 'Scuba Market Thailand',
    ...KATA,
    email: 'scuba-market@divedispatch.dev',
    phone: '+66-76-330-345',
    gasMixes: ['air', 'nitrox', 'trimix'],
    verified: VERIFIED,
  },
}

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

export const WATER_PRO: SeedStakeholder = {
  user: {
    slug: 'b3wt9f',
    email: 'water-pro+clerk_test@divedispatch.dev',
    name: 'Niran Jantarakul',
    firstName: 'Niran',
    lastName: 'Jantarakul',
    businessName: 'Water Pro',
    appLanguage: 'th',
    phone: '+66-76-394-001',
  },
  roles: [
    { role: 'Pool' },
  ],
  pool: {
    name: 'Water Pro',
    ...PHUKET,
    email: 'water-pro@divedispatch.dev',
    phone: '+66-76-394-001',
    maxDepth: 2.5,
    maxCapacity: 25,
    verified: VERIFIED,
    venueCategory: 'pool',
    hasCompressor: false,
  },
}

export const SHARK_BITES: SeedStakeholder = {
  user: {
    slug: 'g2hn6x',
    email: 'shark-bites+clerk_test@divedispatch.dev',
    name: 'Kittisak Wongsawat',
    firstName: 'Kittisak',
    lastName: 'Wongsawat',
    businessName: 'Shark Bites',
    appLanguage: 'th',
    phone: '+66-76-394-002',
  },
  roles: [
    { role: 'Pool' },
  ],
  pool: {
    name: 'Shark Bites',
    ...PHUKET,
    email: 'shark-bites@divedispatch.dev',
    phone: '+66-76-394-002',
    maxDepth: 2.5,
    maxCapacity: 8,
    verified: VERIFIED,
    venueCategory: 'pool',
    hasCompressor: false,
  },
}

export const SCUBA_REVOLUTION: SeedStakeholder = {
  user: {
    slug: 'v8sr2p',
    email: 'scuba-revolution+clerk_test@divedispatch.dev',
    name: 'Anong Petcharat',
    firstName: 'Anong',
    lastName: 'Petcharat',
    businessName: 'Scuba Revolution Phuket',
    appLanguage: 'th',
    phone: '+66-76-330-678',
  },
  roles: [{ role: 'Equipment' }],
  equipment: {
    name: 'Scuba Revolution Phuket',
    placeName: 'Phuket',
    country: 'Thailand',
    lat: 7.8207,
    lng: 98.3425,
    email: 'scuba-revolution@divedispatch.dev',
    phone: '+66-76-330-678',
    manufacturersByGearType: {
      wetsuit: ['ScubaPro', 'Aqua Lung', 'Mares'],
      bcd: ['ScubaPro', 'Aqua Lung', 'Mares'],
    },
    verified: VERIFIED,
  },
}

export const UNOWNED_DIVE_SITES: SeedDiveSite[] = [
  { name: 'Kata Beach', slug: 'kata-beach', capacity: 50 },
]

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
  JIYEON_AGENT,
  KENJI_AGENT,
  EVA_AGENT,
  HANUL_DIVE,
  UMI_DIVE,
  AQUA_PRO,
  PACIFIC_DIVERS,
  BLUE_PLANET,
  WATER_PRO,
  SHARK_BITES,
  CHALONG_COMPRESSOR,
  SCUBA_MARKET,
  SCUBA_REVOLUTION,
  ANDAMAN_EXPLORER,
  CORAL_BAY_RESORT,
]
