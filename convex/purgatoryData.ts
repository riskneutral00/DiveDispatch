import {
  PHUKET,
  PHUKET_TH_ADDRESS,
  type SeedStakeholder,
} from './seedData'

export const PURGATORY_TEST_PASSWORD = 'DiveDispatch-2026!'

export const PHUKET_ADMIN: SeedStakeholder = {
  user: {
    slug: 'admin',
    email: 'admin+clerk_test@divedispatch.dev',
    firstName: 'Matt',
    lastName: 'Admin',
    appLanguage: 'en',
    phone: '+12345678910',
    dateOfBirth: '1985-01-01',
  },
  organization: { name: 'South Andaman', slug: 'south-andaman', isAreaOrg: true },
  roles: [{ role: 'Venue' }],
  venues: [
    { slug: 'racha-yai',    name: 'Racha Yai',          kind: 'dive_site', features: ['reef'],          address: PHUKET_TH_ADDRESS, lat: 7.6018, lng: 98.3633, verified: true },
    { slug: 'racha-noi',    name: 'Racha Noi',          kind: 'dive_site', features: ['reef'],          address: PHUKET_TH_ADDRESS, lat: 7.5367, lng: 98.3461, verified: true },
    { slug: 'ko-bida-nok',  name: 'Ko Bida Nok',        kind: 'dive_site', features: ['reef', 'drift'], address: PHUKET_TH_ADDRESS, lat: 7.6558, lng: 98.7647, verified: true },
    { slug: 'ko-bida-nai',  name: 'Ko Bida Nai',        kind: 'dive_site', features: ['reef', 'drift'], address: PHUKET_TH_ADDRESS, lat: 7.6631, lng: 98.7686, verified: true },
    { slug: 'king-cruiser', name: 'King Cruiser Wreck', kind: 'dive_site', features: ['wreck'],         address: PHUKET_TH_ADDRESS, lat: 7.8067, lng: 98.6167, verified: true },
    { slug: 'shark-point',  name: 'Shark Point',        kind: 'dive_site', features: ['reef', 'drift'], address: PHUKET_TH_ADDRESS, lat: 7.7844, lng: 98.6167, verified: true },
    { slug: 'kata-beach',   name: 'Kata Beach',         kind: 'dive_site', features: [],                address: PHUKET_TH_ADDRESS, lat: 7.8167, lng: 98.2972, verified: true },
    { slug: 'merlin-beach', name: 'Merlin Beach',       kind: 'dive_site', features: [],                address: PHUKET_TH_ADDRESS, lat: 7.9019, lng: 98.2744, verified: true, isAllowed: ['sea-fun-divers'] },
  ],
}

export const SEA_FUN: SeedStakeholder = {
  user: {
    slug: 'sea-fun',
    email: 'rene_balot+clerk_test@seafundivers.com',
    firstName: 'Rene',
    lastName: 'Balot',
    appLanguage: 'en',
    phone: '+6676330345',
    dateOfBirth: '1977-04-04',
  },
  organization: { name: 'Sea Fun Divers', slug: 'sea-fun-divers', destinationSlugs: ['south-andaman'] },
  roles: [
    { role: 'DiveCenter' },
    { role: 'Compressor' },
    { role: 'Equipment' },
    { role: 'Boat' },
    { role: 'Instructor' },
    { role: 'Venue' },
  ],
  diveCenter: {
    name: 'Sea Fun Divers',
    address: { street: '29 Soi Karon Nui', city: 'Karon', state: 'Phuket', country: 'TH', postalCode: '83100' },
    lat: 7.8569,
    lng: 98.2859,
    email: 'rene_balot+clerk_test@seafundivers.com',
    phone: '+6676330345',
    customerLanguages: ['en'],
    associations: [{
      agency: 'PADI',
      number: 'S-65432',
      owDays: 3,
      aowDays: 2,
      oaDays: 4,
      selectedSpecialties: ['Deep', 'Enriched Air', 'Night', 'Wreck', 'Navigation'],
    }],
    isAllowed: ['sea-fun-divers'],
    verified: false,
  },
  equipment: {
    name: 'Sea Fun Divers',
    address: { street: '29 Soi Karon Nui', city: 'Karon', state: 'Phuket', country: 'TH', postalCode: '83100' },
    lat: 7.8569,
    lng: 98.2859,
    email: 'rene_balot+clerk_test@seafundivers.com',
    phone: '+6676330345',
    manufacturersByGearType: {
      wetsuit: ['ScubaPro'],
      bcd: ['ScubaPro'],
      regulator: ['ScubaPro'],
      fins: ['ScubaPro'],
      mask: ['ScubaPro'],
    },
    isAllowed: ['sea-fun-divers'],
    verified: false,
  },
  boat: {
    name: 'Sea Fun Divers Fleet',
    address: { street: '29 Soi Karon Nui', city: 'Karon', state: 'Phuket', country: 'TH', postalCode: '83100' },
    lat: 7.8569,
    lng: 98.2859,
    email: 'rene_balot+clerk_test@seafundivers.com',
    phone: '+6676330345',
    fleet: [{
      boatName: 'M.V. Sea Fun Divers',
      maxPax: 25,
      boatType: 'day_boat',
      routes: [
        { venueSlugs: ['racha-yai', 'racha-noi'],      daysOfWeek: [1, 3, 5] },
        { venueSlugs: ['ko-bida-nok', 'ko-bida-nai'],  daysOfWeek: [2, 4, 6] },
        { venueSlugs: ['king-cruiser', 'shark-point'], daysOfWeek: [0] },
      ],
    }],
    isAllowed: ['sea-fun-divers'],
    verified: false,
  },
  instructor: {
    name: 'Rene Balot',
    role: 'Instructor',
    address: { street: '29 Soi Karon Nui', city: 'Karon', state: 'Phuket', country: 'TH', postalCode: '83100' },
    lat: 7.8569,
    lng: 98.2859,
    email: 'rene_balot+clerk_test@seafundivers.com',
    phone: '+6676330345',
    credential: [{
      agency: 'PADI',
      level: 'MSDT',
      agencyID: 'I-234567',
      specialtyRatings: ['Deep', 'Enriched Air', 'Night', 'Wreck', 'PPB'],
    }],
    teachingLanguages: ['en'],
    isAllowed: ['sea-fun-divers'],
    verified: false,
  },
  venues: [{
    slug: 'sea-fun-pool',
    name: 'Sea Fun Pool',
    kind: 'pool',
    features: [],
    address: { street: '29 Soi Karon Nui', city: 'Karon', state: 'Phuket', country: 'TH', postalCode: '83100' },
    lat: 7.8569,
    lng: 98.2859,
    email: 'rene_balot+clerk_test@seafundivers.com',
    phone: '+6676330345',
    maxDepth: 2.5,
    maxCapacity: 50,
    isAllowed: ['sea-fun-divers'],
    verified: true,
  }],
  compressors: [
    {
      slug: 'scuba-market',
      name: 'Scuba Market',
      address: { street: '51 Patak Road', city: 'Tambon Karon', state: 'Chang Wat Phuket', country: 'TH', postalCode: '83100' },
      lat: 7.820196400000013,
      lng: 98.30618609999999,
      placeId: 'ChIJoVcYq4klUDARy3hTaTDdFRY',
      email: 'rene_balot+clerk_test@seafundivers.com',
      phone: '+6676330345',
      gasMixes: ['air', 'nitrox'],
      nitroxMin: 22,
      nitroxMax: 40,
      verified: false,
    },
  ],
}

export const COMPRESSOR_SHOP_CHALONG: SeedStakeholder = {
  user: {
    slug: 'otud5m',
    email: 'compressor1+clerk_test@divedispatch.dev',
    firstName: 'Kamon',
    lastName: 'Saengkaew',
    nickname: 'bubble',
    appLanguage: 'en',
    phone: '+66834966746',
    dateOfBirth: '1996-09-09',
  },
  organization: { name: 'Compressor Shop Chalong', slug: 'compressor-shop-chalong' },
  roles: [{ role: 'Compressor' }],
  compressors: [
    {
      slug: 'compressor-shop-chalong',
      name: 'Compressor Shop Chalong',
      address: { street: 'ถนน ซันไรซ์', city: 'ราไวย์', state: 'ภูเก็ต', country: 'TH', postalCode: '83130' },
      lat: 7.820217500000005,
      lng: 98.3421578,
      placeId: 'ChIJnZnaMEsvUDARpWaqKUuPJaQ',
      email: 'compressor1+clerk_test@divedispatch.dev',
      phone: '+66834966746',
      gasMixes: ['air', 'nitrox'],
      nitroxMin: 22,
      nitroxMax: 40,
      isAllowed: [],
      notAllowed: [],
      verified: false,
    },
  ],
}

export const SCUBA_REVOLUTION: SeedStakeholder = {
  user: {
    slug: '9973pc',
    email: 'scuba_revolution+clerk_test@divedispatch.dev',
    firstName: 'Anong',
    lastName: 'Petcharat',
    nickname: 'Ta',
    appLanguage: 'en',
    phone: '+66834966746',
    dateOfBirth: '2004-04-07',
  },
  organization: { name: 'Scuba Revolution', slug: 'scuba-revolution' },
  roles: [{ role: 'Equipment' }],
  equipment: {
    name: 'Scuba Revolution',
    address: { street: '43/50', city: 'ตำบล ราไวย์', state: 'ภูเก็ต', country: 'TH', postalCode: '83100' },
    lat: 7.820681100000017,
    lng: 98.34251750000003,
    placeId: 'ChIJW5C1AO8vUDARqPlSwdK2TFk',
    email: 'scuba_revolution+clerk_test@divedispatch.dev',
    phone: '+66834966746',
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const ALL_PURGATORY_STAKEHOLDERS: SeedStakeholder[] = [PHUKET_ADMIN, SEA_FUN, COMPRESSOR_SHOP_CHALONG, SCUBA_REVOLUTION]

export const PIERRE_DUBOIS: SeedStakeholder = {
  user: {
    slug: 'p4dub3',
    email: 'instructor1+clerk_test@divedispatch.dev',
    firstName: 'Pierre',
    lastName: 'Dubois',
    appLanguage: 'en',
    phone: '+66816001001',
    dateOfBirth: '1985-03-22',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Pierre Dubois',
    role: 'Instructor',
    ...PHUKET,
    email: 'instructor1+clerk_test@divedispatch.dev',
    phone: '+66816001001',
    teachingLanguages: ['fr-FR', 'en-GB', 'de-DE'],
    credential: [
      { agency: 'PADI', level: 'MSDT', agencyID: 'PADI-300010', specialtyRatings: ['Deep', 'Wreck', 'Enriched Air', 'S&R', 'Drift'] },
    ],
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const STEFAN_BRAUN: SeedStakeholder = {
  user: {
    slug: 's7brn8',
    email: 'instructor2+clerk_test@divedispatch.dev',
    firstName: 'Stefan',
    lastName: 'Braun',
    appLanguage: 'en',
    phone: '+66816001002',
    dateOfBirth: '1988-06-14',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Stefan Braun',
    role: 'Instructor',
    ...PHUKET,
    email: 'instructor2+clerk_test@divedispatch.dev',
    phone: '+66816001002',
    teachingLanguages: ['de-DE', 'en-GB', 'fr-FR', 'ru-RU'],
    credential: [
      { agency: 'SSI', level: 'OWI', agencyID: 'SSI-500020', specialtyRatings: ['Deep', 'Enriched Air'] },
    ],
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const NATTAYA_SRISUK: SeedStakeholder = {
  user: {
    slug: 'n2sri5',
    email: 'instructor3+clerk_test@divedispatch.dev',
    firstName: 'Nattaya',
    lastName: 'Srisuk',
    appLanguage: 'en',
    phone: '+66816001003',
    dateOfBirth: '1990-09-08',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Nattaya Srisuk',
    role: 'Instructor',
    ...PHUKET,
    email: 'instructor3+clerk_test@divedispatch.dev',
    phone: '+66816001003',
    teachingLanguages: ['th-TH', 'en-GB', 'zh-CN'],
    credential: [
      { agency: 'PADI', level: 'OWSI', agencyID: 'PADI-300030', specialtyRatings: ['Deep', 'Enriched Air', 'Night'] },
    ],
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const ZHANG_YONG: SeedStakeholder = {
  user: {
    slug: 'zy9ng2',
    email: 'instructor4+clerk_test@divedispatch.dev',
    firstName: 'Zhang',
    lastName: 'Yong',
    appLanguage: 'en',
    phone: '+66816001004',
    dateOfBirth: '1986-11-12',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Zhang Yong',
    role: 'Instructor',
    ...PHUKET,
    email: 'instructor4+clerk_test@divedispatch.dev',
    phone: '+66816001004',
    teachingLanguages: ['zh-CN', 'zh-TW', 'en-GB'],
    credential: [
      { agency: 'PADI', level: 'OWSI', agencyID: 'PADI-300040', specialtyRatings: ['Deep', 'Drift'] },
    ],
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const SATO_KENJI: SeedStakeholder = {
  user: {
    slug: 'sk6jp4',
    email: 'instructor5+clerk_test@divedispatch.dev',
    firstName: 'Sato',
    lastName: 'Kenji',
    appLanguage: 'en',
    phone: '+66816001005',
    dateOfBirth: '1992-04-25',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Sato Kenji',
    role: 'Instructor',
    ...PHUKET,
    email: 'instructor5+clerk_test@divedispatch.dev',
    phone: '+66816001005',
    teachingLanguages: ['ja-JP', 'en-GB', 'ko-KR'],
    credential: [
      { agency: 'SSI', level: 'Dive Guide', agencyID: 'SSI-500050', specialtyRatings: [] },
    ],
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const PRASIT_RATTANA: SeedStakeholder = {
  user: {
    slug: 'pr8th1',
    email: 'instructor6+clerk_test@divedispatch.dev',
    firstName: 'Prasit',
    lastName: 'Rattana',
    appLanguage: 'en',
    phone: '+66816001006',
    dateOfBirth: '1989-07-19',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Prasit Rattana',
    role: 'Instructor',
    ...PHUKET,
    email: 'instructor6+clerk_test@divedispatch.dev',
    phone: '+66816001006',
    teachingLanguages: ['th-TH', 'en-GB'],
    credential: [
      { agency: 'PADI', level: 'DM', agencyID: 'PADI-300060', specialtyRatings: [] },
    ],
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const MIKE_CHEN: SeedStakeholder = {
  user: {
    slug: 'mc4cn7',
    email: 'instructor7+clerk_test@divedispatch.dev',
    firstName: 'Mike',
    lastName: 'Chen',
    appLanguage: 'zh-CN',
    phone: '+66816001007',
    dateOfBirth: '1984-02-03',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Mike Chen',
    role: 'Instructor',
    ...PHUKET,
    email: 'instructor7+clerk_test@divedispatch.dev',
    phone: '+66816001007',
    teachingLanguages: ['zh-CN', 'zh-TW', 'th-TH'],
    credential: [
      { agency: 'PADI', level: 'MSDT', agencyID: 'PADI-300070', specialtyRatings: ['Deep', 'Enriched Air', 'Wreck', 'Sidemount', 'DPV', 'Night'] },
      { agency: 'SSI', level: 'OWI', agencyID: 'SSI-500071', specialtyRatings: ['Deep', 'Enriched Air'] },
    ],
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const LEE_MIN_HO: SeedStakeholder = {
  user: {
    slug: 'lm5kr3',
    email: 'instructor8+clerk_test@divedispatch.dev',
    firstName: 'Lee',
    lastName: 'Min-Ho',
    appLanguage: 'ko',
    phone: '+66816001008',
    dateOfBirth: '1987-10-30',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Lee Min-Ho',
    role: 'Instructor',
    ...PHUKET,
    email: 'instructor8+clerk_test@divedispatch.dev',
    phone: '+66816001008',
    teachingLanguages: ['ko-KR', 'zh-CN', 'ja-JP'],
    credential: [
      { agency: 'PADI', level: 'OWSI', agencyID: 'PADI-300080', specialtyRatings: ['Deep', 'Wreck'] },
      { agency: 'SSI', level: 'Advanced OWI', agencyID: 'SSI-500081', specialtyRatings: ['Deep', 'Navigation', 'Enriched Air', 'Altitude', 'S&R'] },
    ],
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const MARIA_SANTOS: SeedStakeholder = {
  user: {
    slug: 'ms9es6',
    email: 'instructor9+clerk_test@divedispatch.dev',
    firstName: 'Maria',
    lastName: 'Santos',
    appLanguage: 'fr',
    phone: '+66816001009',
    dateOfBirth: '1983-12-17',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Maria Santos',
    role: 'Instructor',
    ...PHUKET,
    email: 'instructor9+clerk_test@divedispatch.dev',
    phone: '+66816001009',
    teachingLanguages: ['es-ES', 'fr-FR', 'de-DE'],
    credential: [
      { agency: 'PADI', level: 'MSDT', agencyID: 'PADI-300090', specialtyRatings: ['Deep', 'Enriched Air', 'Sidemount', 'Navigation', 'DPV', 'Wreck'] },
      { agency: 'SSI', level: 'Advanced OWI', agencyID: 'SSI-500091', specialtyRatings: ['Deep', 'Enriched Air', 'Sidemount', 'Navigation', 'S&R'] },
    ],
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const HIROSHI_KATO: SeedStakeholder = {
  user: {
    slug: 'hk3jp9',
    email: 'instructor10+clerk_test@divedispatch.dev',
    firstName: 'Hiroshi',
    lastName: 'Kato',
    appLanguage: 'ko',
    phone: '+66816001010',
    dateOfBirth: '1981-05-28',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Hiroshi Kato',
    role: 'Instructor',
    ...PHUKET,
    email: 'instructor10+clerk_test@divedispatch.dev',
    phone: '+66816001010',
    teachingLanguages: ['ko-KR', 'ja-JP', 'zh-CN'],
    credential: [
      { agency: 'PADI', level: 'MSDT', agencyID: 'PADI-300100', specialtyRatings: ['Deep', 'Wreck', 'Navigation', 'Enriched Air', 'Fish ID'] },
      { agency: 'SSI', level: 'OWI', agencyID: 'SSI-500101', specialtyRatings: ['Deep', 'Wreck'] },
    ],
    isAllowed: [],
    notAllowed: [],
    verified: false,
  },
}

export const ALL_PURGATORY_INSTRUCTORS: SeedStakeholder[] = [PIERRE_DUBOIS, STEFAN_BRAUN, NATTAYA_SRISUK, ZHANG_YONG, SATO_KENJI, PRASIT_RATTANA, MIKE_CHEN, LEE_MIN_HO, MARIA_SANTOS, HIROSHI_KATO]
