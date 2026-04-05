// 45 freelance instructors + 3 DiveMasters for seed data.
// DCs pull instructors by language match.

import { PHUKET, SeedStakeholder, SeedUser, StakeholderRole } from './seedData'

interface InstructorDef {
  firstName: string
  lastName: string
  credentials: { agency: string; level: string }[]
  courses: string[]
  teachingLanguages?: string[]
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
      teachingLanguages: def.teachingLanguages ?? ['en'],
      credential,
      verified: true,
    },
  }
}

const ROSTER: InstructorDef[] = [
  // ── Original Instructors (1-15) ───────────────────────────────────

  // 1. Ryan Clarke
  { firstName: 'Ryan', lastName: 'Clarke', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: [], teachingLanguages: ['en', 'th'] },
  // 2. Nattaya Srisuk
  { firstName: 'Nattaya', lastName: 'Srisuk', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: [], teachingLanguages: ['th', 'en', 'zh-CN'] },
  // 3. Wei Chen
  { firstName: 'Wei', lastName: 'Chen', credentials: [{ agency: 'PADI', level: 'MSDT' }], courses: ['Nitrox', 'Deep', 'Wreck'], teachingLanguages: ['zh-CN', 'zh-TW', 'en', 'th'] },
  // 4. Li Ming
  { firstName: 'Li', lastName: 'Ming', credentials: [{ agency: 'SSI', level: 'OWI' }], courses: [], teachingLanguages: ['zh-CN', 'en', 'ko'] },
  // 5. Zhang Yong
  { firstName: 'Zhang', lastName: 'Yong', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: ['Deep'], teachingLanguages: ['zh-CN', 'zh-TW', 'en'] },
  // 6. Nicole Tam
  { firstName: 'Nicole', lastName: 'Tam', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: ['PPB'], teachingLanguages: ['zh-TW', 'en', 'zh-CN', 'th'] },
  // 7. Pierre Dubois
  { firstName: 'Pierre', lastName: 'Dubois', credentials: [{ agency: 'PADI', level: 'MSDT' }], courses: ['Deep', 'Wreck', 'Nitrox'], teachingLanguages: ['fr', 'en', 'de'] },
  // 8. Stefan Braun
  { firstName: 'Stefan', lastName: 'Braun', credentials: [{ agency: 'SSI', level: 'OWI' }], courses: ['Deep'], teachingLanguages: ['de', 'en', 'fr'] },
  // 9. Somphon Kaew
  { firstName: 'Somphon', lastName: 'Kaew', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: [], teachingLanguages: ['th', 'en'] },
  // 10. Mike Chen (dual)
  { firstName: 'Mike', lastName: 'Chen', credentials: [{ agency: 'PADI', level: 'MSDT' }, { agency: 'SSI', level: 'OWI' }], courses: ['Nitrox', 'Deep', 'Wreck', 'PPB', 'Sidemount'], teachingLanguages: ['zh-CN', 'zh-TW', 'en', 'th'] },
  // 11. Rachel Nguyen (dual)
  { firstName: 'Rachel', lastName: 'Nguyen', credentials: [{ agency: 'PADI', level: 'MSDT' }, { agency: 'SSI', level: 'OWI' }], courses: ['Deep', 'Nitrox'], teachingLanguages: ['en', 'fr', 'th', 'zh-CN'] },
  // 12. Lee Min-Ho (dual)
  { firstName: 'Lee', lastName: 'Min-Ho', credentials: [{ agency: 'PADI', level: 'OWSI' }, { agency: 'SSI', level: 'Advanced OWI' }], courses: ['Deep', 'PPB'], teachingLanguages: ['ko', 'en', 'zh-CN', 'ja'] },
  // 13. David Schmidt (dual)
  { firstName: 'David', lastName: 'Schmidt', credentials: [{ agency: 'PADI', level: 'OWSI' }, { agency: 'SSI', level: 'OWI' }], courses: ['Nitrox'], teachingLanguages: ['de', 'en', 'fr', 'es'] },
  // 14. Yuki Tanaka (dual)
  { firstName: 'Yuki', lastName: 'Tanaka', credentials: [{ agency: 'PADI', level: 'OWSI' }, { agency: 'SSI', level: 'OWI' }], courses: ['Deep', 'Wreck'], teachingLanguages: ['ja', 'en', 'ko', 'zh-CN'] },
  // 15. Maria Santos (dual)
  { firstName: 'Maria', lastName: 'Santos', credentials: [{ agency: 'PADI', level: 'MSDT' }, { agency: 'SSI', level: 'Advanced OWI' }], courses: ['Nitrox', 'Deep', 'PPB', 'Sidemount'], teachingLanguages: ['es', 'en', 'fr', 'de'] },

  // ── Original DiveMasters (16-18) ──────────────────────────────────

  // 16. Arisa Kanchanaburi
  { firstName: 'Arisa', lastName: 'Kanchanaburi', credentials: [{ agency: 'PADI', level: 'Divemaster' }], courses: [], teachingLanguages: ['th', 'en'], role: 'DiveMaster' },
  // 17. Kittipong Jaidee
  { firstName: 'Kittipong', lastName: 'Jaidee', credentials: [{ agency: 'SSI', level: 'Dive Guide' }], courses: [], teachingLanguages: ['th', 'en', 'zh-CN'], role: 'DiveMaster' },
  // 18. Prasit Rattana
  { firstName: 'Prasit', lastName: 'Rattana', credentials: [{ agency: 'PADI', level: 'Divemaster' }], courses: [], teachingLanguages: ['th', 'en'], role: 'DiveMaster' },

  // ── New Instructors (19-48) — 4 languages + 2 specialties each ────

  // Group A: zh-CN, zh-TW, th, en
  { firstName: 'Mei', lastName: 'Lin', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: ['Deep', 'Nitrox'], teachingLanguages: ['zh-CN', 'zh-TW', 'th', 'en'] },
  { firstName: 'Jiahao', lastName: 'Wu', credentials: [{ agency: 'SSI', level: 'OWI' }], courses: ['Wreck', 'PPB'], teachingLanguages: ['zh-CN', 'zh-TW', 'th', 'en'] },
  { firstName: 'Xiao', lastName: 'Lei', credentials: [{ agency: 'PADI', level: 'MSDT' }], courses: ['Deep', 'DPV'], teachingLanguages: ['zh-CN', 'zh-TW', 'th', 'en'] },
  { firstName: 'Zhen', lastName: 'Liu', credentials: [{ agency: 'PADI', level: 'MSDT' }, { agency: 'SSI', level: 'OWI' }], courses: ['Navigation', 'Wreck'], teachingLanguages: ['zh-CN', 'zh-TW', 'th', 'en'] },
  { firstName: 'Suporn', lastName: 'Thani', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: ['Night', 'Deep'], teachingLanguages: ['zh-CN', 'zh-TW', 'th', 'en'] },
  { firstName: 'Natpawee', lastName: 'Chai', credentials: [{ agency: 'SSI', level: 'OWI' }], courses: ['Sidemount', 'Deep'], teachingLanguages: ['zh-CN', 'zh-TW', 'th', 'en'] },
  { firstName: 'Pimchanok', lastName: 'Sri', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: ['Nitrox', 'Fish ID'], teachingLanguages: ['zh-CN', 'zh-TW', 'th', 'en'] },
  { firstName: 'Wanchai', lastName: 'Pong', credentials: [{ agency: 'PADI', level: 'OWSI' }, { agency: 'SSI', level: 'OWI' }], courses: ['Deep', 'Drift'], teachingLanguages: ['zh-CN', 'zh-TW', 'th', 'en'] },

  // Group B: ko, ja, zh-CN, en
  { firstName: 'Kim', lastName: 'Ji-Soo', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: ['Deep', 'PPB'], teachingLanguages: ['ko', 'ja', 'zh-CN', 'en'] },
  { firstName: 'Park', lastName: 'Soo-Jin', credentials: [{ agency: 'SSI', level: 'OWI' }], courses: ['Nitrox', 'Night'], teachingLanguages: ['ko', 'ja', 'zh-CN', 'en'] },
  { firstName: 'Hiroshi', lastName: 'Kato', credentials: [{ agency: 'PADI', level: 'MSDT' }, { agency: 'SSI', level: 'OWI' }], courses: ['Wreck', 'Deep'], teachingLanguages: ['ko', 'ja', 'zh-CN', 'en'] },
  { firstName: 'Yuko', lastName: 'Yamamoto', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: ['DPV', 'Navigation'], teachingLanguages: ['ko', 'ja', 'zh-CN', 'en'] },
  { firstName: 'Aiko', lastName: 'Fujita', credentials: [{ agency: 'SSI', level: 'OWI' }], courses: ['Sidemount', 'Wreck'], teachingLanguages: ['ko', 'ja', 'zh-CN', 'en'] },

  // Group C: fr, de, en, es
  { firstName: 'Camille', lastName: 'Moreau', credentials: [{ agency: 'PADI', level: 'MSDT' }], courses: ['Deep', 'Nitrox'], teachingLanguages: ['fr', 'de', 'en', 'es'] },
  { firstName: 'Hans', lastName: 'Weber', credentials: [{ agency: 'SSI', level: 'Advanced OWI' }], courses: ['Wreck', 'PPB'], teachingLanguages: ['fr', 'de', 'en', 'es'] },
  { firstName: 'Sophie', lastName: 'Laurent', credentials: [{ agency: 'PADI', level: 'OWSI' }, { agency: 'SSI', level: 'OWI' }], courses: ['Navigation', 'Deep'], teachingLanguages: ['fr', 'de', 'en', 'es'] },
  { firstName: 'Klaus', lastName: 'Fischer', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: ['Drift', 'Night'], teachingLanguages: ['fr', 'de', 'en', 'es'] },
  { firstName: 'Ana', lastName: 'Garcia', credentials: [{ agency: 'SSI', level: 'OWI' }], courses: ['Sidemount', 'Deep'], teachingLanguages: ['fr', 'de', 'en', 'es'] },

  // Group D: ru, de, en, fr
  { firstName: 'Alexei', lastName: 'Volkov', credentials: [{ agency: 'PADI', level: 'MSDT' }], courses: ['Deep', 'Wreck'], teachingLanguages: ['ru', 'de', 'en', 'fr'] },
  { firstName: 'Natasha', lastName: 'Ivanova', credentials: [{ agency: 'SSI', level: 'OWI' }], courses: ['Nitrox', 'DPV'], teachingLanguages: ['ru', 'de', 'en', 'fr'] },
  { firstName: 'Dmitri', lastName: 'Petrov', credentials: [{ agency: 'PADI', level: 'OWSI' }, { agency: 'SSI', level: 'OWI' }], courses: ['Deep', 'Night'], teachingLanguages: ['ru', 'de', 'en', 'fr'] },

  // Group E: id, zh-CN, th, en
  { firstName: 'Budi', lastName: 'Santoso', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: ['Deep', 'Nitrox'], teachingLanguages: ['id', 'zh-CN', 'th', 'en'] },
  { firstName: 'Dewi', lastName: 'Rahayu', credentials: [{ agency: 'SSI', level: 'OWI' }], courses: ['Wreck', 'PPB'], teachingLanguages: ['id', 'zh-CN', 'th', 'en'] },
  { firstName: 'Andi', lastName: 'Firmansyah', credentials: [{ agency: 'PADI', level: 'MSDT' }, { agency: 'SSI', level: 'OWI' }], courses: ['Deep', 'DPV'], teachingLanguages: ['id', 'zh-CN', 'th', 'en'] },
  { firstName: 'Ratih', lastName: 'Kusuma', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: ['Navigation', 'Sidemount'], teachingLanguages: ['id', 'zh-CN', 'th', 'en'] },

  // Group F: nl, de, en, fr
  { firstName: 'Lars', lastName: 'van-Dijk', credentials: [{ agency: 'SSI', level: 'Advanced OWI' }], courses: ['Deep', 'Nitrox'], teachingLanguages: ['nl', 'de', 'en', 'fr'] },
  { firstName: 'Ingrid', lastName: 'Bakker', credentials: [{ agency: 'PADI', level: 'OWSI' }], courses: ['Wreck', 'Night'], teachingLanguages: ['nl', 'de', 'en', 'fr'] },
  { firstName: 'Pieter', lastName: 'de-Boer', credentials: [{ agency: 'PADI', level: 'OWSI' }, { agency: 'SSI', level: 'OWI' }], courses: ['PPB', 'Deep'], teachingLanguages: ['nl', 'de', 'en', 'fr'] },

  // Group G: ko, zh-TW, en, ja
  { firstName: 'Seo', lastName: 'Min-Ji', credentials: [{ agency: 'PADI', level: 'MSDT' }], courses: ['DPV', 'Wreck'], teachingLanguages: ['ko', 'zh-TW', 'en', 'ja'] },
  { firstName: 'Oh', lastName: 'Sang-Hoon', credentials: [{ agency: 'SSI', level: 'OWI' }], courses: ['Deep', 'Nitrox'], teachingLanguages: ['ko', 'zh-TW', 'en', 'ja'] },
]

export const ALL_INSTRUCTORS: SeedStakeholder[] = ROSTER.map((def, i) => buildInstructor(def, i))
