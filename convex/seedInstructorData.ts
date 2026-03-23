// 15 freelance instructors + 3 DiveMasters for seed data.
// DCs pull instructors by language match.

import { SeedStakeholder, SeedUser, StakeholderRole } from './seedData'

const PHUKET = { placeName: 'Phuket', country: 'Thailand', lat: 7.8804, lng: 98.3923 } as const

interface InstructorDef {
  firstName: string
  lastName: string
  languages: string[]
  credentials: { agency: string; level: string }[]
  courses: string[]
  role?: 'Instructor' | 'DiveMaster'
}

function toSlug(first: string, last: string): string {
  return `${first}-${last}`.toLowerCase().replace(/\s+/g, '-')
}

function buildInstructor(def: InstructorDef, index: number): SeedStakeholder {
  const slug = toSlug(def.firstName, def.lastName)
  const email = `${slug}+clerk_test@divedispatch.dev`
  const phone = `+66-81-${String(600 + index).padStart(3, '0')}-${String(1000 + index).padStart(4, '0')}`
  const role: StakeholderRole = def.role === 'DiveMaster' ? 'DiveMaster' : 'Instructor'

  const user: SeedUser = {
    slug,
    email,
    name: `${def.firstName} ${def.lastName}`,
    firstName: def.firstName,
    lastName: def.lastName,
    businessName: `${def.firstName} ${def.lastName}`,
    role,
    preferredLocale: 'en',
  }

  const credential = def.credentials.map((c, i) => ({
    agency: c.agency,
    level: c.level,
    agencyID: c.agency === 'PADI' ? `PADI-${300000 + index * 10 + i}` : `SSI-${500000 + index * 10 + i}`,
    // DiveMasters have no courses; Instructors get their specialty courses
    courses: role === 'DiveMaster' ? [] as string[] : def.courses,
  }))

  return {
    user,
    roles: [{ role, isPrimary: true }],
    instructor: {
      name: `${def.firstName} ${def.lastName}`,
      ...PHUKET,
      contactEmail: email,
      contactPhone: phone,
      credential,
      languages: def.languages,
      verified: true,
    },
  }
}

const ROSTER: InstructorDef[] = [
  // ── Instructors (1-15) ────────────────────────────────────────────

  // 1. Ryan Clarke
  {
    firstName: 'Ryan',
    lastName: 'Clarke',
    languages: ['GB', 'TH'],
    credentials: [{ agency: 'PADI', level: 'OWSI' }],
    courses: [],
  },

  // 2. Nattaya Srisuk
  {
    firstName: 'Nattaya',
    lastName: 'Srisuk',
    languages: ['TH', 'GB'],
    credentials: [{ agency: 'PADI', level: 'OWSI' }],
    courses: [],
  },

  // 3. Wei Chen
  {
    firstName: 'Wei',
    lastName: 'Chen',
    languages: ['CN', 'GB'],
    credentials: [{ agency: 'PADI', level: 'MSDT' }],
    courses: ['Nitrox', 'Deep', 'Wreck'],
  },

  // 4. Li Ming
  {
    firstName: 'Li',
    lastName: 'Ming',
    languages: ['CN', 'GB'],
    credentials: [{ agency: 'SSI', level: 'OWI' }],
    courses: [],
  },

  // 5. Zhang Yong
  {
    firstName: 'Zhang',
    lastName: 'Yong',
    languages: ['CN', 'TW', 'GB'],
    credentials: [{ agency: 'PADI', level: 'OWSI' }],
    courses: ['Deep'],
  },

  // 6. Nicole Tam
  {
    firstName: 'Nicole',
    lastName: 'Tam',
    languages: ['TW', 'GB'],
    credentials: [{ agency: 'PADI', level: 'OWSI' }],
    courses: ['PPB'],
  },

  // 7. Pierre Dubois
  {
    firstName: 'Pierre',
    lastName: 'Dubois',
    languages: ['FR', 'GB'],
    credentials: [{ agency: 'PADI', level: 'MSDT' }],
    courses: ['Deep', 'Wreck', 'Nitrox'],
  },

  // 8. Stefan Braun
  {
    firstName: 'Stefan',
    lastName: 'Braun',
    languages: ['DE', 'GB', 'TH'],
    credentials: [{ agency: 'SSI', level: 'OWI' }],
    courses: ['Deep'],
  },

  // 9. Somphon Kaew
  {
    firstName: 'Somphon',
    lastName: 'Kaew',
    languages: ['TH', 'CN', 'GB'],
    credentials: [{ agency: 'PADI', level: 'OWSI' }],
    courses: [],
  },

  // 10. Mike Chen (dual PADI + SSI)
  {
    firstName: 'Mike',
    lastName: 'Chen',
    languages: ['GB', 'CN', 'TW'],
    credentials: [
      { agency: 'PADI', level: 'MSDT' },
      { agency: 'SSI', level: 'OWI' },
    ],
    courses: ['Nitrox', 'Deep', 'Wreck', 'PPB', 'Sidemount'],
  },

  // 11. Rachel Nguyen (dual PADI + SSI)
  {
    firstName: 'Rachel',
    lastName: 'Nguyen',
    languages: ['GB', 'CN'],
    credentials: [
      { agency: 'PADI', level: 'MSDT' },
      { agency: 'SSI', level: 'OWI' },
    ],
    courses: ['Deep', 'Nitrox'],
  },

  // 12. Lee Min-Ho (dual PADI + SSI)
  {
    firstName: 'Lee',
    lastName: 'Min-Ho',
    languages: ['GB', 'KR', 'CN'],
    credentials: [
      { agency: 'PADI', level: 'OWSI' },
      { agency: 'SSI', level: 'Advanced OWI' },
    ],
    courses: ['Deep', 'PPB'],
  },

  // 13. David Schmidt (dual PADI + SSI)
  {
    firstName: 'David',
    lastName: 'Schmidt',
    languages: ['DE', 'GB'],
    credentials: [
      { agency: 'PADI', level: 'OWSI' },
      { agency: 'SSI', level: 'OWI' },
    ],
    courses: ['Nitrox'],
  },

  // 14. Yuki Tanaka (dual PADI + SSI)
  {
    firstName: 'Yuki',
    lastName: 'Tanaka',
    languages: ['JP', 'GB'],
    credentials: [
      { agency: 'PADI', level: 'OWSI' },
      { agency: 'SSI', level: 'OWI' },
    ],
    courses: ['Deep', 'Wreck'],
  },

  // 15. Maria Santos (dual PADI + SSI)
  {
    firstName: 'Maria',
    lastName: 'Santos',
    languages: ['GB', 'FR', 'TH'],
    credentials: [
      { agency: 'PADI', level: 'MSDT' },
      { agency: 'SSI', level: 'Advanced OWI' },
    ],
    courses: ['Nitrox', 'Deep', 'PPB', 'Sidemount'],
  },

  // ── DiveMasters (16-18) ───────────────────────────────────────────

  // 16. Arisa Kanchanaburi
  {
    firstName: 'Arisa',
    lastName: 'Kanchanaburi',
    languages: ['TH', 'GB'],
    credentials: [{ agency: 'PADI', level: 'Divemaster' }],
    courses: [],
    role: 'DiveMaster',
  },

  // 17. Kittipong Jaidee
  {
    firstName: 'Kittipong',
    lastName: 'Jaidee',
    languages: ['TH', 'GB'],
    credentials: [{ agency: 'SSI', level: 'Dive Guide' }],
    courses: [],
    role: 'DiveMaster',
  },

  // 18. Prasit Rattana
  {
    firstName: 'Prasit',
    lastName: 'Rattana',
    languages: ['TH', 'GB'],
    credentials: [{ agency: 'PADI', level: 'Divemaster' }],
    courses: [],
    role: 'DiveMaster',
  },
]

export const ALL_INSTRUCTORS: SeedStakeholder[] = ROSTER.map((def, i) => buildInstructor(def, i))
