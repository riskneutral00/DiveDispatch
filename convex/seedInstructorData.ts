// 15 freelance instructors + 3 DiveMasters for seed data.
// DCs pull instructors by language match.

import { SeedStakeholder, SeedUser, StakeholderRole } from './seedData'

const PHUKET = { placeName: 'Phuket', country: 'Thailand', lat: 7.8804, lng: 98.3923 } as const

interface InstructorDef {
  firstName: string
  lastName: string
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
    appLanguage: 'en',
    phone,
  }

  const instructorCourses =
    role === 'DiveMaster' ? ([] as string[]) : def.courses.length > 0 ? def.courses : ['OW']

  const credential = def.credentials.map((c, i) => ({
    agency: c.agency,
    level: c.level,
    agencyID: c.agency === 'PADI' ? `PADI-${300000 + index * 10 + i}` : `SSI-${500000 + index * 10 + i}`,
    // DiveMasters have no courses; Instructors need at least one course code (completeness + schema semantics)
    courses: instructorCourses,
  }))

  return {
    user,
    roles: [{ role }],
    instructor: {
      name: `${def.firstName} ${def.lastName}`,
      ...PHUKET,
      email,
      phone,
      teachingLanguages: ['en'],
      credential,
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
    credentials: [{ agency: 'PADI', level: 'OWSI' }],
    courses: [],
  },

  // 2. Nattaya Srisuk
  {
    firstName: 'Nattaya',
    lastName: 'Srisuk',
    credentials: [{ agency: 'PADI', level: 'OWSI' }],
    courses: [],
  },

  // 3. Wei Chen
  {
    firstName: 'Wei',
    lastName: 'Chen',
    credentials: [{ agency: 'PADI', level: 'MSDT' }],
    courses: ['Nitrox', 'Deep', 'Wreck'],
  },

  // 4. Li Ming
  {
    firstName: 'Li',
    lastName: 'Ming',
    credentials: [{ agency: 'SSI', level: 'OWI' }],
    courses: [],
  },

  // 5. Zhang Yong
  {
    firstName: 'Zhang',
    lastName: 'Yong',
    credentials: [{ agency: 'PADI', level: 'OWSI' }],
    courses: ['Deep'],
  },

  // 6. Nicole Tam
  {
    firstName: 'Nicole',
    lastName: 'Tam',
    credentials: [{ agency: 'PADI', level: 'OWSI' }],
    courses: ['PPB'],
  },

  // 7. Pierre Dubois
  {
    firstName: 'Pierre',
    lastName: 'Dubois',
    credentials: [{ agency: 'PADI', level: 'MSDT' }],
    courses: ['Deep', 'Wreck', 'Nitrox'],
  },

  // 8. Stefan Braun
  {
    firstName: 'Stefan',
    lastName: 'Braun',
    credentials: [{ agency: 'SSI', level: 'OWI' }],
    courses: ['Deep'],
  },

  // 9. Somphon Kaew
  {
    firstName: 'Somphon',
    lastName: 'Kaew',
    credentials: [{ agency: 'PADI', level: 'OWSI' }],
    courses: [],
  },

  // 10. Mike Chen (dual PADI + SSI)
  {
    firstName: 'Mike',
    lastName: 'Chen',
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
    credentials: [{ agency: 'PADI', level: 'Divemaster' }],
    courses: [],
    role: 'DiveMaster',
  },

  // 17. Kittipong Jaidee
  {
    firstName: 'Kittipong',
    lastName: 'Jaidee',
    credentials: [{ agency: 'SSI', level: 'Dive Guide' }],
    courses: [],
    role: 'DiveMaster',
  },

  // 18. Prasit Rattana
  {
    firstName: 'Prasit',
    lastName: 'Rattana',
    credentials: [{ agency: 'PADI', level: 'Divemaster' }],
    courses: [],
    role: 'DiveMaster',
  },
]

export const ALL_INSTRUCTORS: SeedStakeholder[] = ROSTER.map((def, i) => buildInstructor(def, i))
