// 40 freelance instructors for seed data.
// DCs pull instructors by language match.

import { SeedStakeholder, SeedUser } from './seedData'

const PHUKET = { city: 'Phuket', country: 'Thailand' } as const

const PADI_OW_COURSES = ['Open Water', 'Advanced Open Water', 'Rescue Diver', 'Divemaster']
const SSI_OW_COURSES = ['Open Water Diver', 'Advanced Adventurer', 'Diver Stress & Rescue', 'Dive Guide']

interface InstructorDef {
  firstName: string
  lastName: string
  languages: string[]
  credentials: { agency: string; level: string }[]
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
    businessName: `${def.firstName} ${def.lastName}`,
    role: 'Instructor',
    preferredLocale: 'en',
  }

  const credential = def.credentials.map((c, i) => ({
    agency: c.agency,
    level: c.level,
    agencyID: c.agency === 'PADI' ? `PADI-${300000 + index * 10 + i}` : `SSI-${500000 + index * 10 + i}`,
    courses: c.agency === 'PADI' ? PADI_OW_COURSES : SSI_OW_COURSES,
  }))

  return {
    user,
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
  // ── English-primary (1) ───────────────────────────────────────────
  { firstName: 'Ryan', lastName: 'Clarke', languages: ['English', 'French'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },

  // ── Thai-primary (2–6) ────────────────────────────────────────────
  { firstName: 'Nattaya', lastName: 'Srisuk', languages: ['Thai'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Kittipong', lastName: 'Jaidee', languages: ['Thai', 'English'], credentials: [{ agency: 'PADI', level: 'MSDT' }] },
  { firstName: 'Arisa', lastName: 'Tanaka', languages: ['Thai', 'Japanese'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Prasit', lastName: 'Wongsawat', languages: ['Thai'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Supachai', lastName: 'Rattana', languages: ['Thai', 'English'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },

  // ── Mandarin-primary (7–14) ───────────────────────────────────────
  { firstName: 'Wei', lastName: 'Chen', languages: ['Mandarin'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Li', lastName: 'Ming', languages: ['Mandarin', 'English'], credentials: [{ agency: 'PADI', level: 'MSDT' }] },
  { firstName: 'Zhang', lastName: 'Yong', languages: ['Mandarin'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Wang', lastName: 'Fei', languages: ['Mandarin', 'English'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Huang', lastName: 'Jie', languages: ['Mandarin'], credentials: [{ agency: 'PADI', level: 'MSDT' }] },
  { firstName: 'Chen', lastName: 'Xiaoli', languages: ['Mandarin', 'Thai'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Liu', lastName: 'Hao', languages: ['Mandarin'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Xu', lastName: 'Wei', languages: ['Mandarin', 'English'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },

  // ── Chinese-primary (15–18) ───────────────────────────────────────
  { firstName: 'Zhou', lastName: 'Peng', languages: ['Chinese'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Sun', lastName: 'Jing', languages: ['Chinese', 'English'], credentials: [{ agency: 'PADI', level: 'MSDT' }] },
  { firstName: 'Ma', lastName: 'Lin', languages: ['Chinese'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Gao', lastName: 'Tian', languages: ['Chinese', 'Thai'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },

  // ── French-primary (19–22) ────────────────────────────────────────
  { firstName: 'Pierre', lastName: 'Dubois', languages: ['French', 'English'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Marie', lastName: 'Lefevre', languages: ['French'], credentials: [{ agency: 'PADI', level: 'MSDT' }] },
  { firstName: 'Antoine', lastName: 'Bernard', languages: ['French', 'Thai'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Sophie', lastName: 'Martin', languages: ['French', 'English'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },

  // ── German-primary (23–25) ────────────────────────────────────────
  { firstName: 'Klaus', lastName: 'Weber', languages: ['German', 'English'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Stefan', lastName: 'Braun', languages: ['German'], credentials: [{ agency: 'PADI', level: 'MSDT' }] },
  { firstName: 'Heidi', lastName: 'Fischer', languages: ['German', 'Thai'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },

  // ── Cantonese-primary (26–28) ─────────────────────────────────────
  { firstName: 'Chan', lastName: 'Wing', languages: ['Cantonese', 'English'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Lam', lastName: 'Ka Yan', languages: ['Cantonese'], credentials: [{ agency: 'PADI', level: 'MSDT' }] },
  { firstName: 'Ho', lastName: 'Siu Ming', languages: ['Cantonese', 'English'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },

  // ── Korean-primary (29–30) ────────────────────────────────────────
  { firstName: 'Park', lastName: 'Joon', languages: ['Korean', 'English'], credentials: [{ agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'Kim', lastName: 'Soo-Yeon', languages: ['Korean'], credentials: [{ agency: 'PADI', level: 'MSDT' }] },

  // ── SSI-only (31–36) ──────────────────────────────────────────────
  { firstName: 'Yuki', lastName: 'Tanaka', languages: ['Japanese', 'English'], credentials: [{ agency: 'SSI', level: 'OWI' }] },
  { firstName: 'Kenji', lastName: 'Nakamura', languages: ['Japanese'], credentials: [{ agency: 'SSI', level: 'Specialty Instructor' }] },
  { firstName: 'Dmitri', lastName: 'Volkov', languages: ['Russian', 'English'], credentials: [{ agency: 'SSI', level: 'OWI' }] },
  { firstName: 'Olga', lastName: 'Petrova', languages: ['Russian'], credentials: [{ agency: 'SSI', level: 'Specialty Instructor' }] },
  { firstName: 'Ben', lastName: 'Walker', languages: ['English'], credentials: [{ agency: 'SSI', level: 'OWI' }] },
  { firstName: 'Alex', lastName: 'Turner', languages: ['English', 'Thai'], credentials: [{ agency: 'SSI', level: 'Specialty Instructor' }] },

  // ── Dual-certified PADI + SSI (37–40) ─────────────────────────────
  { firstName: 'Mike', lastName: 'Chen', languages: ['Mandarin', 'English'], credentials: [{ agency: 'PADI', level: 'OWSI' }, { agency: 'SSI', level: 'OWI' }] },
  { firstName: 'Rachel', lastName: 'Nguyen', languages: ['English', 'French'], credentials: [{ agency: 'PADI', level: 'MSDT' }, { agency: 'SSI', level: 'Specialty Instructor' }] },
  { firstName: 'Lee', lastName: 'Min-Ho', languages: ['Korean', 'English'], credentials: [{ agency: 'SSI', level: 'OWI' }, { agency: 'PADI', level: 'OWSI' }] },
  { firstName: 'David', lastName: 'Schmidt', languages: ['German', 'English'], credentials: [{ agency: 'PADI', level: 'OWSI' }, { agency: 'SSI', level: 'OWI' }] },
]

export const ALL_INSTRUCTORS: SeedStakeholder[] = ROSTER.map((def, i) => buildInstructor(def, i))
