import {
  PHUKET,
  PHUKET_TH_ADDRESS,
  CHALONG,
  VERIFIED,
  PADI_PREFS,
  SSI_PREFS,
  ALL_DAYS,
  type SeedStakeholder,
} from './seedData'

export const HUG_OCEAN: SeedStakeholder = {
  user: {
    slug: 'n7rq5j',
    email: 'hug-ocean+clerk_test@divedispatch.dev',
    firstName: 'Somchai',
    lastName: 'Prasert',
    appLanguage: 'zh-CN',
    phone: '+66812345001',
    dateOfBirth: '1985-01-01',
  },
  roles: [
    { role: 'DiveCenter' },
    { role: 'Boat' },
    { role: 'Venue' },
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
        routes: [{ venueSlugs: [], daysOfWeek: ALL_DAYS }],
      },
    ],
    verified: VERIFIED,
  },
  venues: [{
    slug: 'hug-ocean-pool',
    name: 'Hug Ocean',
    kind: 'pool',
    features: [],
    ...PHUKET,
    email: 'hug-ocean@divedispatch.dev',
    phone: '+6676381102',
    maxDepth: 3,
    maxCapacity: 15,
    verified: VERIFIED,
  }],
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
    firstName: 'Wei',
    lastName: 'Lin',
    appLanguage: 'zh-CN',
    phone: '+66812345002',
    dateOfBirth: '1985-01-01',
  },
  roles: [
    { role: 'DiveCenter' },
    { role: 'Venue' },
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
  venues: [{
    slug: 'neptune-pool',
    name: 'Neptune',
    kind: 'pool',
    features: [],
    ...PHUKET,
    email: 'neptune@divedispatch.dev',
    phone: '+6676383002',
    maxDepth: 2.5,
    maxCapacity: 6,
    verified: VERIFIED,
  }],
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
    firstName: 'Kittisak',
    lastName: 'Charoen',
    appLanguage: 'th',
    phone: '+66812345003',
    dateOfBirth: '1985-01-01',
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
          { venueSlugs: [], daysOfWeek: [1, 4, 6] },
          { venueSlugs: [], daysOfWeek: [2] },
          { venueSlugs: [], daysOfWeek: [3, 5, 0] },
        ],
      },
      {
        boatName: 'M.V. Mandarin Queen 7',
        maxPax: 90,
        boatType: 'day_boat',
        routes: [
          { venueSlugs: [], daysOfWeek: [2, 5, 0] },
          { venueSlugs: [], daysOfWeek: [3] },
          { venueSlugs: [], daysOfWeek: [1, 4, 6] },
        ],
      },
    ],
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
    firstName: 'Nicole',
    lastName: 'Huang',
    appLanguage: 'zh-TW',
    phone: '+66812345004',
    dateOfBirth: '1985-01-01',
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
    verified: VERIFIED,
  },
}

export const MANTA_DC: SeedStakeholder = {
  user: {
    slug: 'v6js2t',
    email: 'manta-dive-center+clerk_test@divedispatch.dev',
    firstName: 'Pierre',
    lastName: 'Duval',
    appLanguage: 'fr',
    phone: '+66812345005',
    dateOfBirth: '1985-01-01',
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
    firstName: 'Nick',
    lastName: 'Harrison',
    appLanguage: 'en',
    phone: '+66812345006',
    dateOfBirth: '1985-01-01',
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
    firstName: 'James',
    lastName: 'Mitchell',
    appLanguage: 'en',
    phone: '+66812345007',
    dateOfBirth: '1985-01-01',
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
    firstName: 'Prasit',
    lastName: 'Wongsawat',
    appLanguage: 'th',
    phone: '+66812345008',
    dateOfBirth: '1985-01-01',
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
          { venueSlugs: [], daysOfWeek: [1, 2, 5, 6] },
          { venueSlugs: [], daysOfWeek: [3] },
          { venueSlugs: [], daysOfWeek: [4, 0] },
        ],
      },
    ],
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
    firstName: 'Anong',
    lastName: 'Srisuk',
    appLanguage: 'en',
    phone: '+66812345009',
    dateOfBirth: '1985-01-01',
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
    firstName: 'Joon-Woo',
    lastName: 'Park',
    appLanguage: 'ko',
    phone: '+66812345013',
    dateOfBirth: '1985-01-01',
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
    firstName: 'Haruto',
    lastName: 'Tanaka',
    appLanguage: 'en',
    phone: '+66812345015',
    dateOfBirth: '1985-01-01',
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
    firstName: 'Sergei',
    lastName: 'Kozlov',
    appLanguage: 'en',
    phone: '+66812345016',
    dateOfBirth: '1985-01-01',
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
    firstName: 'Carlos',
    lastName: 'Mendoza',
    appLanguage: 'en',
    phone: '+66812345017',
    dateOfBirth: '1985-01-01',
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
    firstName: 'Willem',
    lastName: 'de Groot',
    appLanguage: 'en',
    phone: '+66812345018',
    dateOfBirth: '1985-01-01',
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
    firstName: 'Amanda',
    lastName: 'Chen',
    appLanguage: 'zh-CN',
    phone: '+66812345010',
    customerLanguages: ['zh-CN', 'zh-TW', 'en', 'th'],
    dateOfBirth: '1985-01-01',
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
    firstName: 'Ji-Yeon',
    lastName: 'Park',
    appLanguage: 'ko',
    phone: '+821034567890',
    customerLanguages: ['ko', 'en'],
    dateOfBirth: '1985-01-01',
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
    firstName: 'Kenji',
    lastName: 'Watanabe',
    appLanguage: 'en',
    phone: '+819012345678',
    customerLanguages: ['ja', 'en'],
    dateOfBirth: '1985-01-01',
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
    firstName: 'Eva',
    lastName: 'Klein',
    appLanguage: 'en',
    phone: '+491701234567',
    customerLanguages: ['de', 'fr', 'nl'],
    dateOfBirth: '1985-01-01',
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

export const WATER_PRO: SeedStakeholder = {
  user: {
    slug: 'b3wt9f',
    email: 'water-pro+clerk_test@divedispatch.dev',
    firstName: 'Niran',
    lastName: 'Jantarakul',
    appLanguage: 'th',
    phone: '+6676394001',
    dateOfBirth: '1985-01-01',
  },
  roles: [
    { role: 'Venue' },
  ],
  venues: [{
    slug: 'water-pro',
    name: 'Water Pro',
    kind: 'pool',
    features: [],
    ...PHUKET,
    email: 'water-pro@divedispatch.dev',
    phone: '+6676394001',
    maxDepth: 2.5,
    maxCapacity: 25,
    verified: VERIFIED,
  }],
}

export const SHARK_BITES: SeedStakeholder = {
  user: {
    slug: 'g2hn6x',
    email: 'shark-bites+clerk_test@divedispatch.dev',
    firstName: 'Kittisak',
    lastName: 'Wongsawat',
    appLanguage: 'th',
    phone: '+6676394002',
    dateOfBirth: '1985-01-01',
  },
  roles: [
    { role: 'Venue' },
  ],
  venues: [{
    slug: 'shark-bites',
    name: 'Shark Bites',
    kind: 'pool',
    features: [],
    ...PHUKET,
    email: 'shark-bites@divedispatch.dev',
    phone: '+6676394002',
    maxDepth: 2.5,
    maxCapacity: 8,
    verified: VERIFIED,
  }],
}

export const SCUBA_REVOLUTION: SeedStakeholder = {
  user: {
    slug: 'v8sr2p',
    email: 'scuba-revolution+clerk_test@divedispatch.dev',
    firstName: 'Anong',
    lastName: 'Petcharat',
    appLanguage: 'th',
    phone: '+6676330678',
    dateOfBirth: '1985-01-01',
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
]

