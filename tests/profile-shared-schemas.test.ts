import { describe, it, expect } from 'vitest'
import {
  contactSchema,
  diveCenterLanguagesSchema,
  diveCenterAffiliationsSchema,
  agentContactSchema,
  agentLanguagesSchema,
  agentAssociationsSchema,
  personalContactSchema,
  personalLanguagesSchema,
  diveMasterCredentialsSchema,
  instructorCredentialsSchema,
} from '../src/lib/schemas/profile-shared'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validLocation = { placeName: 'Koh Tao', country: 'TH', lat: 10.09, lng: 99.84 }
const validLang = { code: 'en', label: 'English' }

// ---------------------------------------------------------------------------
// contactSchema
// ---------------------------------------------------------------------------

describe('contactSchema', () => {
  const valid = {
    name: 'Ocean Divers',
    location: validLocation,
    email: 'info@ocean.com',
    phone: '+1-555-0100',
  }

  it('accepts valid contact data', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = contactSchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects null location', () => {
    const result = contactSchema.safeParse({ ...valid, location: null })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = contactSchema.safeParse({ ...valid, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects empty phone', () => {
    const result = contactSchema.safeParse({ ...valid, phone: '' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// diveCenterLanguagesSchema
// ---------------------------------------------------------------------------

describe('diveCenterLanguagesSchema', () => {
  it('accepts valid languages array', () => {
    const result = diveCenterLanguagesSchema.safeParse({ customerLanguages: [validLang] })
    expect(result.success).toBe(true)
  })

  it('rejects empty languages array', () => {
    const result = diveCenterLanguagesSchema.safeParse({ customerLanguages: [] })
    expect(result.success).toBe(false)
  })

  it('rejects missing customerLanguages', () => {
    const result = diveCenterLanguagesSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// diveCenterAffiliationsSchema
// ---------------------------------------------------------------------------

describe('diveCenterAffiliationsSchema', () => {
  const validAssoc = {
    agency: 'PADI',
    number: 'S-12345',
    owDays: 3,
    aowDays: 2,
    oaDays: 4,
    selectedSpecialties: ['Navigation', 'Deep', 'Wreck', 'Night', 'PPB'],
  }

  it('accepts valid affiliations with enough specialties', () => {
    const result = diveCenterAffiliationsSchema.safeParse({ associations: [validAssoc] })
    expect(result.success).toBe(true)
  })

  it('rejects empty associations array', () => {
    const result = diveCenterAffiliationsSchema.safeParse({ associations: [] })
    expect(result.success).toBe(false)
  })

  it('rejects association with empty agency', () => {
    const result = diveCenterAffiliationsSchema.safeParse({
      associations: [{ ...validAssoc, agency: '' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects association with too few specialties for a known agency (PADI requires 5)', () => {
    const result = diveCenterAffiliationsSchema.safeParse({
      associations: [{ ...validAssoc, selectedSpecialties: ['Navigation', 'Deep'] }],
    })
    expect(result.success).toBe(false)
  })

  it('allows unknown agency to pass specialty count check (defaults to 5 — must provide 5)', () => {
    // AGENCIES[unknown] is undefined, fallback ?? 5 means 5 required
    const result = diveCenterAffiliationsSchema.safeParse({
      associations: [
        {
          ...validAssoc,
          agency: 'UNKNOWN',
          number: 'X-999',
          selectedSpecialties: ['A', 'B', 'C', 'D', 'E'],
        },
      ],
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// agentContactSchema
// ---------------------------------------------------------------------------

describe('agentContactSchema', () => {
  const valid = {
    name: 'Reef Agent',
    location: validLocation,
    email: 'agent@reef.com',
    phone: '+66-81-000-0000',
  }

  it('accepts valid agent contact', () => {
    expect(agentContactSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = agentContactSchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// agentLanguagesSchema
// ---------------------------------------------------------------------------

describe('agentLanguagesSchema', () => {
  it('accepts valid customerLanguages', () => {
    const result = agentLanguagesSchema.safeParse({ customerLanguages: [validLang] })
    expect(result.success).toBe(true)
  })

  it('rejects empty array', () => {
    const result = agentLanguagesSchema.safeParse({ customerLanguages: [] })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// agentAssociationsSchema
// ---------------------------------------------------------------------------

describe('agentAssociationsSchema', () => {
  const validAssoc = { agency: 'PADI', number: 'A-001' }

  it('accepts valid associations array', () => {
    const result = agentAssociationsSchema.safeParse({ associations: [validAssoc] })
    expect(result.success).toBe(true)
  })

  it('accepts empty associations array (agents may have none)', () => {
    const result = agentAssociationsSchema.safeParse({ associations: [] })
    expect(result.success).toBe(true)
  })

  it('rejects association with empty agency', () => {
    const result = agentAssociationsSchema.safeParse({
      associations: [{ agency: '', number: 'A-001' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects association with empty member ID', () => {
    const result = agentAssociationsSchema.safeParse({
      associations: [{ agency: 'PADI', number: '' }],
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// personalContactSchema
// ---------------------------------------------------------------------------

describe('personalContactSchema', () => {
  const valid = {
    location: validLocation,
    email: 'jane@dive.com',
    phone: '+1-555-9999',
  }

  it('accepts valid personal contact without name', () => {
    expect(personalContactSchema.safeParse(valid).success).toBe(true)
  })

  it('drops name when provided (derived server-side)', () => {
    const parsed = personalContactSchema.safeParse({ ...valid, name: 'Jane' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('name')
    }
  })

  it('rejects null location', () => {
    const result = personalContactSchema.safeParse({ ...valid, location: null })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = personalContactSchema.safeParse({ ...valid, email: 'bad' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// personalLanguagesSchema
// ---------------------------------------------------------------------------

describe('personalLanguagesSchema', () => {
  it('accepts valid teachingLanguages', () => {
    const result = personalLanguagesSchema.safeParse({ teachingLanguages: [validLang] })
    expect(result.success).toBe(true)
  })

  it('rejects empty teachingLanguages array', () => {
    const result = personalLanguagesSchema.safeParse({ teachingLanguages: [] })
    expect(result.success).toBe(false)
  })

  it('rejects customerLanguages (wrong field name)', () => {
    const result = personalLanguagesSchema.safeParse({ customerLanguages: [validLang] })
    // teachingLanguages is missing, so it fails
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// diveMasterCredentialsSchema
// ---------------------------------------------------------------------------

describe('diveMasterCredentialsSchema', () => {
  const validCred = { agency: 'PADI', level: 'Divemaster', agencyID: 'DM-55555' }

  it('accepts valid credentials array with one entry', () => {
    const result = diveMasterCredentialsSchema.safeParse({ credential: [validCred] })
    expect(result.success).toBe(true)
  })

  it('rejects empty credentials array', () => {
    const result = diveMasterCredentialsSchema.safeParse({ credential: [] })
    expect(result.success).toBe(false)
  })

  it('rejects credential with empty agency', () => {
    const result = diveMasterCredentialsSchema.safeParse({
      credential: [{ ...validCred, agency: '' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects credential with empty level', () => {
    const result = diveMasterCredentialsSchema.safeParse({
      credential: [{ ...validCred, level: '' }],
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// instructorCredentialsSchema
// ---------------------------------------------------------------------------

describe('instructorCredentialsSchema', () => {
  const validCred = {
    agency: 'PADI',
    level: 'Open Water Scuba Instructor',
    agencyID: 'I-550453',
    specialtyRatings: ['Deep Diver', 'Wreck Diver'],
  }

  it('accepts valid instructor credential with specialtyRatings', () => {
    const result = instructorCredentialsSchema.safeParse({ credential: [validCred] })
    expect(result.success).toBe(true)
  })

  it('rejects empty credentials array', () => {
    const result = instructorCredentialsSchema.safeParse({ credential: [] })
    expect(result.success).toBe(false)
  })

  it('accepts credential with empty specialtyRatings', () => {
    const result = instructorCredentialsSchema.safeParse({
      credential: [{ ...validCred, specialtyRatings: [] }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects credential missing agencyID', () => {
    const result = instructorCredentialsSchema.safeParse({
      credential: [{ ...validCred, agencyID: '' }],
    })
    expect(result.success).toBe(false)
  })
})
