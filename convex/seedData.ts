import type { StakeholderRole } from './lib/validators'
import {
  SCUBAPRO_WETSUITS, SCUBAPRO_BCDS,
  AQUALUNG_WETSUITS, AQUALUNG_BCDS,
  MARES_WETSUITS, MARES_BCDS,
} from './shared/gearSizing'
export type { StakeholderRole }

const PHUKET_TH_ADDRESS = { city: 'Phuket', country: 'TH' } as const
export const PHUKET = { address: PHUKET_TH_ADDRESS, lat: 7.8804, lng: 98.3923 } as const
const CHALONG = { address: { city: 'Phuket', state: 'Phuket', country: 'TH' } as const, lat: 7.8386, lng: 98.3519 } as const
const VERIFIED = true

const PADI_PREFS = { owDays: 3, aowDays: 2, oaDays: 4, selectedSpecialties: ['Deep', 'Drift', 'Wreck', 'Navigation'] }
const SSI_PREFS = { owDays: 3, aowDays: 2, oaDays: 4, selectedSpecialties: ['Deep', 'Navigation', 'Wreck'] }

export type BoatType = 'day_boat' | 'speedboat' | 'longtail' | 'liveaboard' | 'catamaran' | 'rib'

export type GasMixType = 'air' | 'nitrox'

export type SeedAppLanguage = 'en' | 'zh-CN' | 'zh-TW' | 'th' | 'fr' | 'ko'

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
  name: string
  firstName: string
  lastName: string
  appLanguage: SeedAppLanguage
  phone: string
  dateOfBirth?: string
  customerLanguages?: string[]
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
  customerLanguages: string[]
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
    routes?: { diveSite: string; daysOfWeek: number[] }[]
    cutoffHours?: number
  }[]
  hasCompressor: boolean
  verified: boolean
}

interface VenueProfile {
  name: string
  address: SeedAddress
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
  address: SeedAddress
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
  address: SeedAddress
  lat: number
  lng: number
  email: string
  phone: string
  gasMixes?: GasMixType[]
  nitroxMin?: number
  nitroxMax?: number
  isAllowed?: string[]
  notAllowed?: string[]
  verified: boolean
}

interface LiveaboardProfile {
  name: string
  address: SeedAddress
  lat: number
  lng: number
  email: string
  phone: string
  verified: boolean
}

interface DiveResortProfile {
  name: string
  address: SeedAddress
  lat: number
  lng: number
  email: string
  phone: string
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
    appLanguage: 'zh-CN',
    phone: '+66812345001',
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
    phone: '+6676381100',
    associations: [{ agency: 'PADI', number: 'S-34782', ...PADI_PREFS }],
    customerLanguages: ['zh-CN', 'zh-TW', 'th', 'en'],
    verified: VERIFIED,
  },
  boat: {
    name: 'M.V. Hug Ocean',
    ...PHUKET,
    email: 'hug-ocean@divedispatch.dev',
    phone: '+6676381101',
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
    phone: '+6676381102',
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
    phone: '+6676381103',
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
    appLanguage: 'zh-CN',
    phone: '+66812345002',
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
    phone: '+6676383001',
    associations: [{ agency: 'PADI', number: 'S-41256', ...PADI_PREFS }],
    customerLanguages: ['zh-CN', 'zh-TW', 'en', 'th'],
    verified: VERIFIED,
  },
  pool: {
    name: 'Neptune',
    ...PHUKET,
    email: 'neptune@divedispatch.dev',
    phone: '+6676383002',
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
    phone: '+6676383003',
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
    appLanguage: 'th',
    phone: '+66812345003',
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
    phone: '+6676385001',
    associations: [{ agency: 'PADI', number: 'S-29815', ...PADI_PREFS }],
    customerLanguages: ['th', 'en', 'zh-CN', 'ko'],
    verified: VERIFIED,
  },
  boat: {
    name: 'Mandarin Queen',
    ...PHUKET,
    email: 'phuket-dive-center@divedispatch.dev',
    phone: '+6676385002',
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
    phone: '+6676385003',
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
    appLanguage: 'zh-TW',
    phone: '+66812345004',
  },
  roles: [
    { role: 'DiveCenter' },
    { role: 'Equipment' },
  ],
  diveCenter: {
    name: 'Nicole Dive Center',
    ...PHUKET,
    email: 'nicole-dive-center@divedispatch.dev',
    phone: '+6676386001',
    associations: [{ agency: 'PADI', number: 'S-55198', ...PADI_PREFS }],
    customerLanguages: ['zh-TW', 'zh-CN', 'en', 'th'],
    verified: VERIFIED,
  },
  equipment: {
    name: 'Nicole Dive Center',
    ...PHUKET,
    email: 'nicole-dive-center@divedispatch.dev',
    phone: '+6676386002',
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
    appLanguage: 'fr',
    phone: '+66812345005',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Manta Dive Center',
    ...PHUKET,
    email: 'manta-dive-center@divedispatch.dev',
    phone: '+6676387001',
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
    appLanguage: 'en',
    phone: '+66812345006',
  },
  roles: [
    { role: 'DiveCenter' },
    { role: 'Equipment' },
  ],
  diveCenter: {
    name: 'ScubaNicks',
    ...PHUKET,
    email: 'scubanicks@divedispatch.dev',
    phone: '+6676388001',
    associations: [{ agency: 'SSI', number: 'DC-91547', ...SSI_PREFS }],
    customerLanguages: ['en', 'th', 'zh-CN'],
    verified: VERIFIED,
  },
  equipment: {
    name: 'ScubaNicks',
    ...PHUKET,
    email: 'scubanicks@divedispatch.dev',
    phone: '+6676388002',
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
    appLanguage: 'en',
    phone: '+66812345007',
  },
  roles: [
    { role: 'DiveCenter' },
    { role: 'Equipment' },
  ],
  diveCenter: {
    name: 'Scuba Deep',
    ...PHUKET,
    email: 'scuba-deep@divedispatch.dev',
    phone: '+6676389001',
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
    phone: '+6676389003',
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
    appLanguage: 'th',
    phone: '+66812345008',
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
    phone: '+6676391001',
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
    phone: '+6676391002',
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
    phone: '+6676391003',
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
    appLanguage: 'en',
    phone: '+66812345009',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Pray Dive Center',
    ...PHUKET,
    email: 'pray-dive-center@divedispatch.dev',
    phone: '+6676390001',
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
    appLanguage: 'ko',
    phone: '+66812345013',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Hanul Dive',
    ...PHUKET,
    email: 'hanul-dive@divedispatch.dev',
    phone: '+6676396001',
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
    appLanguage: 'en',
    phone: '+66812345015',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Umi Dive Center',
    ...PHUKET,
    email: 'umi-dive@divedispatch.dev',
    phone: '+6676396002',
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
    appLanguage: 'en',
    phone: '+66812345016',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Aqua Pro Dive',
    ...PHUKET,
    email: 'aqua-pro@divedispatch.dev',
    phone: '+6676396003',
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
    appLanguage: 'en',
    phone: '+66812345017',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Pacific Divers',
    ...PHUKET,
    email: 'pacific-divers@divedispatch.dev',
    phone: '+6676396004',
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
    appLanguage: 'en',
    phone: '+66812345018',
  },
  roles: [
    { role: 'DiveCenter' },
  ],
  diveCenter: {
    name: 'Blue Planet Diving',
    ...PHUKET,
    email: 'blue-planet@divedispatch.dev',
    phone: '+6676396005',
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
    appLanguage: 'zh-CN',
    phone: '+66812345010',
    customerLanguages: ['zh-CN', 'zh-TW', 'en', 'th'],
  },
  roles: [
    { role: 'Agent' },
  ],
  agent: {
    name: 'Amanda',
    ...PHUKET,
    email: 'amanda@divedispatch.dev',
    phone: '+66815550012',
    associations: [{ agency: 'PADI', number: 'A-10482' }],
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
    appLanguage: 'ko',
    phone: '+821034567890',
    customerLanguages: ['ko', 'en'],
  },
  roles: [{ role: 'Agent' }],
  agent: {
    name: 'JY Dive Travel',
    address: { city: 'Seoul', country: 'KR' },
    lat: 37.5665,
    lng: 126.9780,
    email: 'jiyeon@divedispatch.dev',
    phone: '+821034567890',
    associations: [
      { agency: 'PADI', number: 'A-20501' },
      { agency: 'SSI', number: 'A-20502' },
    ],
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
    appLanguage: 'en',
    phone: '+819012345678',
    customerLanguages: ['ja', 'en'],
  },
  roles: [{ role: 'Agent' }],
  agent: {
    name: 'Watanabe Dive',
    address: { city: 'Tokyo', country: 'JP' },
    lat: 35.6762,
    lng: 139.6503,
    email: 'kenji@divedispatch.dev',
    phone: '+819012345678',
    associations: [
      { agency: 'PADI', number: 'A-20503' },
      { agency: 'SSI', number: 'A-20504' },
    ],
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
    appLanguage: 'en',
    phone: '+491701234567',
    customerLanguages: ['de', 'fr', 'nl'],
  },
  roles: [{ role: 'Agent' }],
  agent: {
    name: 'Klein Dive Europe',
    address: { city: 'Berlin', country: 'DE' },
    lat: 52.5200,
    lng: 13.4050,
    email: 'eva@divedispatch.dev',
    phone: '+491701234567',
    associations: [
      { agency: 'PADI', number: 'A-20505' },
      { agency: 'SSI', number: 'A-20506' },
    ],
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
    appLanguage: 'en',
    phone: '+66812345011',
  },
  roles: [
    { role: 'Liveaboard' },
  ],
  liveaboard: {
    name: 'Andaman Explorer',
    ...PHUKET,
    email: 'andaman-explorer@divedispatch.dev',
    phone: '+6676392001',
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
    appLanguage: 'th',
    phone: '+66812345012',
  },
  roles: [
    { role: 'DiveResort' },
  ],
  diveResort: {
    name: 'Coral Bay Resort',
    ...PHUKET,
    email: 'coral-bay-resort@divedispatch.dev',
    phone: '+6676393001',
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
    appLanguage: 'th',
    phone: '+6676394001',
  },
  roles: [
    { role: 'Pool' },
  ],
  pool: {
    name: 'Water Pro',
    ...PHUKET,
    email: 'water-pro@divedispatch.dev',
    phone: '+6676394001',
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
    appLanguage: 'th',
    phone: '+6676394002',
  },
  roles: [
    { role: 'Pool' },
  ],
  pool: {
    name: 'Shark Bites',
    ...PHUKET,
    email: 'shark-bites@divedispatch.dev',
    phone: '+6676394002',
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
    appLanguage: 'th',
    phone: '+6676330678',
  },
  roles: [{ role: 'Equipment' }],
  equipment: {
    name: 'Scuba Revolution Phuket',
    address: PHUKET_TH_ADDRESS,
    lat: 7.8207,
    lng: 98.3425,
    email: 'scuba-revolution@divedispatch.dev',
    phone: '+6676330678',
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

export const RESTORED_PRAWIT: SeedStakeholder = {
  user: {
    slug: 'wkxhew',
    email: 'scuba-market+clerk_test@divedispatch.dev',
    name: 'Prawit Suksawat',
    firstName: 'Prawit',
    lastName: 'Suksawat',
    appLanguage: 'th',
    phone: '+6676330345',
    dateOfBirth: '1975-08-12',
  },
  roles: [{ role: 'Compressor' }],
  compressor: {
    name: 'Scuba Market Thailand',
    address: { street: '44 Thanon Kata, Tambon Karon', city: 'Phuket', state: 'Phuket', country: 'TH', postalCode: '83100' },
    lat: 7.8215228,
    lng: 98.3062015,
    email: 'scuba-market+clerk_test@divedispatch.dev',
    phone: '+6676330345',
    gasMixes: ['air', 'nitrox'],
    nitroxMin: 32,
    nitroxMax: 32,
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const RESTORED_SOMBAT: SeedStakeholder = {
  user: {
    slug: 'h0a5zl',
    email: 'compressor-chalong+clerk_test@divedispatch.dev',
    name: 'Sombat Charoensuk',
    firstName: 'Sombat',
    lastName: 'Charoensuk',
    appLanguage: 'th',
    phone: '+6676395001',
    dateOfBirth: '1982-04-20',
  },
  roles: [{ role: 'Compressor' }],
  compressor: {
    name: 'Compressor Shop Chalong Pier',
    address: { street: 'Asian Divers, Wiset Rd, Tambon Karon', city: 'Phuket', state: 'Phuket', country: 'TH', postalCode: '83100' },
    lat: 7.8203607,
    lng: 98.3423974,
    email: 'compressor-chalong+clerk_test@divedispatch.dev',
    phone: '+66812345014',
    gasMixes: ['air', 'nitrox'],
    nitroxMin: 32,
    nitroxMax: 32,
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const RESTORED_ALEX: SeedStakeholder = {
  user: {
    slug: 'ax3k7p',
    email: 'ax3k7p+clerk_test@divedispatch.dev',
    name: 'Alex Walker',
    firstName: 'Alex',
    lastName: 'Walker',
    appLanguage: 'en',
    phone: '+66819001234',
    dateOfBirth: '1992-04-17',
    customerLanguages: ['en'],
  },
  roles: [{ role: 'Agent' }],
  agent: {
    name: 'Alex Walker',
    ...PHUKET,
    email: 'ax3k7p+clerk_test@divedispatch.dev',
    phone: '+66819001234',
    associations: [{ agency: 'PADI', number: 'PAD-AG-70001' }],
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const PARKED_STAKEHOLDERS: SeedStakeholder[] = [
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
  SCUBA_REVOLUTION,
  ANDAMAN_EXPLORER,
  CORAL_BAY_RESORT,
]

function equipmentOnly(parked: SeedStakeholder): SeedStakeholder {
  if (!parked.equipment) throw new Error(`equipmentOnly: ${parked.user.slug} has no equipment block`)
  return {
    user: parked.user,
    roles: [{ role: 'Equipment' }],
    equipment: { ...parked.equipment, isAllowed: [], notAllowed: [] },
  }
}

export const ALL_STAKEHOLDERS: SeedStakeholder[] = [
  RESTORED_PRAWIT,
  RESTORED_SOMBAT,
  RESTORED_ALEX,
  WATER_PRO,
  SHARK_BITES,
  ...PARKED_STAKEHOLDERS.filter((p) => p.equipment && !p.pool && !p.boat).map(equipmentOnly),
]
