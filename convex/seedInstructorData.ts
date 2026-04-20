import { PHUKET, SeedStakeholder, SeedUser } from './seedData'

interface InstructorDef {
  firstName: string
  lastName: string
  credentials: { agency: string; level: string; specialtyRatings: string[] }[]
  teachingLanguages: string[]
}

function toSlug(first: string, last: string): string {
  return `${first}-${last}`.toLowerCase().replace(/\s+/g, '-')
}

function buildInstructor(def: InstructorDef, index: number): SeedStakeholder {
  const slug = toSlug(def.firstName, def.lastName)
  const email = `${slug}+clerk_test@divedispatch.dev`
  const phone = `+66-81-${String(600 + index).padStart(3, '0')}-${String(1000 + index).padStart(4, '0')}`

  const user: SeedUser = {
    slug,
    email,
    name: `${def.firstName} ${def.lastName}`,
    firstName: def.firstName,
    lastName: def.lastName,
    appLanguage: 'en',
    phone,
  }

  const credential = def.credentials.map((c, i) => ({
    agency: c.agency,
    level: c.level,
    agencyID: c.agency === 'PADI' ? `PADI-${300000 + index * 10 + i}` : `SSI-${500000 + index * 10 + i}`,
    specialtyRatings: c.specialtyRatings,
  }))

  return {
    user,
    roles: [{ role: 'Instructor' }],
    instructor: {
      name: `${def.firstName} ${def.lastName}`,
      role: 'Instructor',
      ...PHUKET,
      email,
      phone,
      teachingLanguages: def.teachingLanguages,
      credential,
      verified: true,
    },
  }
}

const ROSTER: InstructorDef[] = [

  { firstName: 'Nattaya', lastName: 'Srisuk', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep', 'Enriched Air', 'Night'] }], teachingLanguages: ['th', 'en', 'zh-CN'] },
  { firstName: 'Wei', lastName: 'Chen', credentials: [{ agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'Enriched Air', 'Wreck', 'Navigation', 'Night'] }], teachingLanguages: ['zh-CN', 'zh-TW', 'th'] },
  { firstName: 'Li', lastName: 'Ming', credentials: [{ agency: 'SSI', level: 'OWI', specialtyRatings: ['Deep'] }], teachingLanguages: ['zh-CN', 'en', 'ko'] },
  { firstName: 'Zhang', lastName: 'Yong', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep', 'Drift'] }], teachingLanguages: ['zh-CN', 'zh-TW', 'en'] },
  { firstName: 'Nicole', lastName: 'Tam', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Night', 'Fish ID'] }], teachingLanguages: ['zh-TW', 'zh-CN', 'th'] },
  { firstName: 'Pierre', lastName: 'Dubois', credentials: [{ agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'Wreck', 'Enriched Air', 'S&R', 'Drift'] }], teachingLanguages: ['fr', 'en', 'de'] },
  { firstName: 'Stefan', lastName: 'Braun', credentials: [{ agency: 'SSI', level: 'OWI', specialtyRatings: ['Deep', 'Enriched Air'] }], teachingLanguages: ['de', 'en', 'fr', 'ru'] },
  { firstName: 'Somphon', lastName: 'Kaew', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep', 'Navigation', 'Boat'] }], teachingLanguages: ['th', 'en'] },
  { firstName: 'Mike', lastName: 'Chen', credentials: [{ agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'Enriched Air', 'Wreck', 'Sidemount', 'DPV', 'Night'] }, { agency: 'SSI', level: 'OWI', specialtyRatings: ['Deep', 'Enriched Air'] }], teachingLanguages: ['zh-CN', 'zh-TW', 'th'] },
  { firstName: 'Rachel', lastName: 'Nguyen', credentials: [{ agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'Enriched Air', 'Navigation', 'Night', 'Photo/Video'] }, { agency: 'SSI', level: 'OWI', specialtyRatings: ['Deep'] }], teachingLanguages: ['fr', 'th', 'zh-CN'] },
  { firstName: 'Lee', lastName: 'Min-Ho', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep', 'Wreck'] }, { agency: 'SSI', level: 'Advanced OWI', specialtyRatings: ['Deep', 'Navigation', 'Enriched Air', 'Altitude', 'S&R'] }], teachingLanguages: ['ko', 'zh-CN', 'ja'] },
  { firstName: 'David', lastName: 'Schmidt', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Enriched Air', 'Drift'] }, { agency: 'SSI', level: 'OWI', specialtyRatings: ['Enriched Air'] }], teachingLanguages: ['de', 'fr', 'es'] },
  { firstName: 'Yuki', lastName: 'Tanaka', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep', 'Wreck', 'Night'] }, { agency: 'SSI', level: 'OWI', specialtyRatings: ['Deep', 'Wreck'] }], teachingLanguages: ['ja', 'ko', 'zh-CN'] },
  { firstName: 'Maria', lastName: 'Santos', credentials: [{ agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'Enriched Air', 'Sidemount', 'Navigation', 'DPV', 'Wreck'] }, { agency: 'SSI', level: 'Advanced OWI', specialtyRatings: ['Deep', 'Enriched Air', 'Sidemount', 'Navigation', 'S&R'] }], teachingLanguages: ['es', 'fr', 'de'] },

  { firstName: 'Kittipong', lastName: 'Jaidee', credentials: [{ agency: 'SSI', level: 'Dive Guide', specialtyRatings: [] }], teachingLanguages: ['th', 'en', 'zh-CN'] },
  { firstName: 'Prasit', lastName: 'Rattana', credentials: [{ agency: 'PADI', level: 'DM', specialtyRatings: [] }], teachingLanguages: ['th', 'en'] },
  { firstName: 'Tanawat', lastName: 'Boon', credentials: [{ agency: 'PADI', level: 'DM', specialtyRatings: [] }], teachingLanguages: ['th', 'en', 'zh-CN'] },
  { firstName: 'Sato', lastName: 'Kenji', credentials: [{ agency: 'SSI', level: 'Dive Guide', specialtyRatings: [] }], teachingLanguages: ['ja', 'en', 'ko'] },

  { firstName: 'Mei', lastName: 'Lin', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep', 'Enriched Air'] }], teachingLanguages: ['zh-CN', 'zh-TW', 'th'] },
  { firstName: 'Jiahao', lastName: 'Wu', credentials: [{ agency: 'SSI', level: 'OWI', specialtyRatings: ['Wreck', 'Boat'] }], teachingLanguages: ['zh-CN', 'zh-TW', 'th'] },
  { firstName: 'Xiao', lastName: 'Lei', credentials: [{ agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'DPV', 'Navigation', 'Enriched Air', 'Wreck'] }], teachingLanguages: ['zh-CN', 'zh-TW', 'th'] },
  { firstName: 'Zhen', lastName: 'Liu', credentials: [{ agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'Navigation', 'Wreck', 'Boat', 'Night'] }, { agency: 'SSI', level: 'OWI', specialtyRatings: ['Deep', 'Navigation'] }], teachingLanguages: ['zh-CN', 'zh-TW', 'th'] },
  { firstName: 'Suporn', lastName: 'Thani', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Night', 'Deep'] }], teachingLanguages: ['zh-CN', 'zh-TW', 'th'] },
  { firstName: 'Natpawee', lastName: 'Chai', credentials: [{ agency: 'SSI', level: 'OWI', specialtyRatings: ['Sidemount', 'Deep'] }], teachingLanguages: ['zh-CN', 'zh-TW', 'th'] },
  { firstName: 'Pimchanok', lastName: 'Sri', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Enriched Air', 'Fish ID'] }], teachingLanguages: ['zh-CN', 'zh-TW', 'th'] },
  { firstName: 'Wanchai', lastName: 'Pong', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep', 'Drift', 'Boat'] }, { agency: 'SSI', level: 'OWI', specialtyRatings: ['Deep'] }], teachingLanguages: ['zh-CN', 'zh-TW', 'th'] },
  { firstName: 'Kim', lastName: 'Ji-Soo', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep', 'Navigation'] }], teachingLanguages: ['ko', 'ja', 'zh-CN'] },
  { firstName: 'Park', lastName: 'Soo-Jin', credentials: [{ agency: 'SSI', level: 'OWI', specialtyRatings: ['Enriched Air', 'Night'] }], teachingLanguages: ['ko', 'ja', 'zh-CN'] },
  { firstName: 'Hiroshi', lastName: 'Kato', credentials: [{ agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'Wreck', 'Navigation', 'Enriched Air', 'Fish ID'] }, { agency: 'SSI', level: 'OWI', specialtyRatings: ['Deep', 'Wreck'] }], teachingLanguages: ['ko', 'ja', 'zh-CN'] },
  { firstName: 'Yuko', lastName: 'Yamamoto', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['DPV', 'Navigation'] }], teachingLanguages: ['ko', 'ja', 'zh-CN'] },
  { firstName: 'Aiko', lastName: 'Fujita', credentials: [{ agency: 'SSI', level: 'OWI', specialtyRatings: ['Sidemount', 'Wreck'] }], teachingLanguages: ['ko', 'ja', 'zh-CN'] },
  { firstName: 'Camille', lastName: 'Moreau', credentials: [{ agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'Enriched Air', 'Navigation', 'Drift', 'S&R'] }], teachingLanguages: ['fr', 'de', 'es'] },
  { firstName: 'Hans', lastName: 'Weber', credentials: [{ agency: 'SSI', level: 'Advanced OWI', specialtyRatings: ['Deep', 'Wreck', 'Navigation', 'Enriched Air', 'Dry Suit'] }], teachingLanguages: ['fr', 'de', 'es', 'ru'] },
  { firstName: 'Sophie', lastName: 'Laurent', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Navigation', 'Deep', 'Boat'] }, { agency: 'SSI', level: 'OWI', specialtyRatings: ['Deep'] }], teachingLanguages: ['fr', 'de', 'es'] },
  { firstName: 'Klaus', lastName: 'Fischer', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Drift', 'Night'] }], teachingLanguages: ['fr', 'de', 'es'] },
  { firstName: 'Ana', lastName: 'Garcia', credentials: [{ agency: 'SSI', level: 'OWI', specialtyRatings: ['Sidemount', 'Deep'] }], teachingLanguages: ['fr', 'de', 'es'] },
  { firstName: 'Alexei', lastName: 'Volkov', credentials: [{ agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'Wreck', 'Navigation', 'Dry Suit', 'Ice'] }], teachingLanguages: ['ru', 'de', 'fr'] },
  { firstName: 'Natasha', lastName: 'Ivanova', credentials: [{ agency: 'SSI', level: 'OWI', specialtyRatings: ['Enriched Air', 'DPV'] }], teachingLanguages: ['ru', 'de', 'fr'] },
  { firstName: 'Dmitri', lastName: 'Petrov', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep', 'Night', 'Enriched Air'] }, { agency: 'SSI', level: 'OWI', specialtyRatings: ['Deep'] }], teachingLanguages: ['ru', 'de', 'fr'] },
  { firstName: 'Budi', lastName: 'Santoso', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep', 'Enriched Air'] }], teachingLanguages: ['id', 'zh-CN', 'th'] },
  { firstName: 'Dewi', lastName: 'Rahayu', credentials: [{ agency: 'SSI', level: 'OWI', specialtyRatings: ['Wreck', 'Night'] }], teachingLanguages: ['id', 'zh-CN', 'th'] },
  { firstName: 'Andi', lastName: 'Firmansyah', credentials: [{ agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'DPV', 'Navigation', 'Enriched Air', 'Boat'] }, { agency: 'SSI', level: 'OWI', specialtyRatings: ['Deep'] }], teachingLanguages: ['id', 'zh-CN', 'th'] },
  { firstName: 'Ratih', lastName: 'Kusuma', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Navigation', 'Sidemount'] }], teachingLanguages: ['id', 'zh-CN', 'th'] },
  { firstName: 'Lars', lastName: 'van-Dijk', credentials: [{ agency: 'SSI', level: 'Advanced OWI', specialtyRatings: ['Deep', 'Enriched Air', 'Navigation', 'Night', 'DPV'] }], teachingLanguages: ['nl', 'de', 'fr', 'ru'] },
  { firstName: 'Ingrid', lastName: 'Bakker', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Wreck', 'Night'] }], teachingLanguages: ['nl', 'de', 'fr'] },
  { firstName: 'Pieter', lastName: 'de-Boer', credentials: [{ agency: 'PADI', level: 'OWSI', specialtyRatings: ['Deep', 'Boat'] }, { agency: 'SSI', level: 'OWI', specialtyRatings: ['Deep'] }], teachingLanguages: ['nl', 'de', 'fr'] },
  { firstName: 'Seo', lastName: 'Min-Ji', credentials: [{ agency: 'PADI', level: 'MSDT', specialtyRatings: ['Deep', 'DPV', 'Wreck', 'Navigation', 'Photo/Video'] }], teachingLanguages: ['ko', 'zh-TW', 'ja'] },
  { firstName: 'Oh', lastName: 'Sang-Hoon', credentials: [{ agency: 'SSI', level: 'OWI', specialtyRatings: ['Deep', 'Enriched Air'] }], teachingLanguages: ['ko', 'zh-TW', 'ja'] },
]

export const PARKED_INSTRUCTORS: SeedStakeholder[] = ROSTER.map((def, i) => buildInstructor(def, i))

const PHUKET_CHALONG = {
  placeName: 'Chalong, Mueang Phuket District, Phuket',
  country: 'Thailand',
  lat: 7.8367169,
  lng: 98.3483897,
} as const

export const RESTORED_RYAN: SeedStakeholder = {
  user: {
    slug: 'geprkx',
    email: 'ryan-clarke+clerk_test@divedispatch.dev',
    name: 'Ryan Clarke',
    firstName: 'Ryan',
    lastName: 'Clarke',
    appLanguage: 'en',
    phone: '+66816001000',
    dateOfBirth: '1985-03-22',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Ryan Clarke',
    role: 'Instructor',
    ...PHUKET_CHALONG,
    email: 'ryan-clarke+clerk_test@divedispatch.dev',
    phone: '+66816001000',
    teachingLanguages: ['en-GB', 'th-TH'],
    credential: [
      {
        agency: 'PADI',
        level: 'OWSI',
        agencyID: '3000000',
        specialtyRatings: ['Deep', 'Navigation'],
      },
    ],
    verified: false,
  },
}

export const RESTORED_ARISA: SeedStakeholder = {
  user: {
    slug: 'z039zt',
    email: 'arisa-kanchanaburi+clerk_test@divedispatch.dev',
    name: 'Arisa Kanchanaburi',
    firstName: 'Arisa',
    lastName: 'Kanchanaburi',
    appLanguage: 'en',
    phone: '+66816151015',
    dateOfBirth: '1993-12-01',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Arisa Kanchanaburi',
    role: 'Instructor',
    ...PHUKET_CHALONG,
    email: 'arisa-kanchanaburi+clerk_test@divedispatch.dev',
    phone: '+66816151015',
    teachingLanguages: ['en-GB', 'th-TH'],
    credential: [
      {
        agency: 'PADI',
        level: 'DM',
        agencyID: '300150',
        specialtyRatings: [],
      },
    ],
    verified: false,
  },
}

const PHUKET_ISLAND = {
  placeName: 'Phuket',
  country: 'Thailand',
  lat: 7.8804,
  lng: 98.3923,
} as const

export const RESTORED_LIMING: SeedStakeholder = {
  user: {
    slug: 'lkp3zm',
    email: 'li-ming+clerk_test@divedispatch.dev',
    name: 'Li Ming',
    firstName: 'Li',
    lastName: 'Ming',
    appLanguage: 'en',
    phone: '+66816031003',
    dateOfBirth: '1991-07-14',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Li Ming',
    role: 'Instructor',
    ...PHUKET_ISLAND,
    email: 'li-ming+clerk_test@divedispatch.dev',
    phone: '+66816031003',
    teachingLanguages: ['zh-CN', 'en', 'ko'],
    credential: [
      {
        agency: 'SSI',
        level: 'OWI',
        agencyID: 'SSI-500030',
        specialtyRatings: ['Deep'],
      },
    ],
    verified: false,
  },
}

export const RESTORED_WEICHEN: SeedStakeholder = {
  user: {
    slug: 'wc8qg2',
    email: 'wei-chen+clerk_test@divedispatch.dev',
    name: 'Wei Chen',
    firstName: 'Wei',
    lastName: 'Chen',
    appLanguage: 'en',
    phone: '+66816021002',
    dateOfBirth: '1989-02-10',
  },
  roles: [{ role: 'Instructor' }],
  instructor: {
    name: 'Wei Chen',
    role: 'Instructor',
    ...PHUKET_ISLAND,
    email: 'wei-chen+clerk_test@divedispatch.dev',
    phone: '+66816021002',
    teachingLanguages: ['zh-CN', 'zh-TW', 'th', 'en'],
    credential: [
      {
        agency: 'PADI',
        level: 'MSDT',
        agencyID: 'PADI-300020',
        specialtyRatings: ['Deep', 'Enriched Air', 'Wreck', 'Navigation', 'Night'],
      },
    ],
    verified: false,
  },
}

export const ALL_INSTRUCTORS: SeedStakeholder[] = [
  RESTORED_RYAN,
  RESTORED_ARISA,
  RESTORED_LIMING,
  RESTORED_WEICHEN,
]
