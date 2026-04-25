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
  instructorCredentialsSchema,
  diveSiteDetailsSchema,
  venueCapabilitiesSchema,
} from '../src/lib/schemas/profile-shared'

const validLocation = {
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.09,
  lng: 99.84,
}
const validLang = { code: 'en', label: 'English' }

describe('contactSchema', () => {
  const valid = {
    name: 'Ocean Divers',
    location: validLocation,
    email: 'info@ocean.com',
    phone: '+12025550100',
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

  it('rejects dashed phone (not E.164)', () => {
    const result = contactSchema.safeParse({ ...valid, phone: '+1-555-0100' })
    expect(result.success).toBe(false)
  })

  it('rejects address missing country', () => {
    const result = contactSchema.safeParse({
      ...valid,
      location: { address: { city: 'Phuket' }, lat: 7.88, lng: 98.39 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid country code', () => {
    const result = contactSchema.safeParse({
      ...valid,
      location: { address: { city: 'Phuket', country: 'Thailand' }, lat: 7.88, lng: 98.39 },
    })
    expect(result.success).toBe(false)
  })
})

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

describe('agentContactSchema', () => {
  const valid = {
    name: 'Reef Agent',
    location: validLocation,
    email: 'agent@reef.com',
    phone: '+66810000000',
  }

  it('accepts valid agent contact', () => {
    expect(agentContactSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = agentContactSchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
  })
})

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

describe('personalContactSchema', () => {
  const valid = {
    location: validLocation,
    email: 'jane@dive.com',
    phone: '+12025559999',
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
    expect(result.success).toBe(false)
  })
})

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

describe('diveSiteDetailsSchema', () => {
  it('accepts valid dive site details', () => {
    expect(
      diveSiteDetailsSchema.safeParse({
        name: 'Similan Island #9',
        location: validLocation,
        kind: "dive_site",
      }).success,
    ).toBe(true)
  })

  it('rejects null location', () => {
    expect(
      diveSiteDetailsSchema.safeParse({
        name: 'Similan Island #9',
        location: null,
        kind: "dive_site",
      }).success,
    ).toBe(false)
  })

  it('rejects diveSiteTypes array field', () => {
    expect(
      diveSiteDetailsSchema.safeParse({
        name: 'Similan Island #9',
        location: validLocation,
        diveSiteTypes: ['reef'],
      }).success,
    ).toBe(false)
  })

  it('rejects invalid subtype literal', () => {
    expect(
      diveSiteDetailsSchema.safeParse({
        name: 'Similan Island #9',
        location: validLocation,
        subtype: 'nonsense',
      }).success,
    ).toBe(false)
  })
})

describe('venueCapabilitiesSchema', () => {
  it('accepts a valid pool capability', () => {
    const result = venueCapabilitiesSchema.safeParse({
      kind: 'pool',
      features: [],
      maxDepth: 5,
      maxCapacity: 20,
      confinedCapable: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects pool maxDepth not in 0.5 m increments', () => {
    const result = venueCapabilitiesSchema.safeParse({
      kind: 'pool',
      features: [],
      maxDepth: 5.25,
      maxCapacity: 20,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.path[0] === 'maxDepth' && i.message === 'Must be in 0.5 m increments',
        ),
      ).toBe(true)
    }
  })

  it('rejects non-integer maxCapacity', () => {
    const result = venueCapabilitiesSchema.safeParse({
      kind: 'pool',
      features: [],
      maxDepth: 5,
      maxCapacity: 5.5,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'maxCapacity')).toBe(true)
    }
  })

  it('accepts pool with confinedCapable=false (schema does not enforce the pool↔confined pairing)', () => {
    const result = venueCapabilitiesSchema.safeParse({
      kind: 'pool',
      features: [],
      maxDepth: 5,
      maxCapacity: 20,
      confinedCapable: false,
    })
    expect(result.success).toBe(true)
  })

  it('accepts dive_site with optional maxDepth only', () => {
    const result = venueCapabilitiesSchema.safeParse({
      kind: 'dive_site',
      features: ['reef'],
      maxDepth: 40,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a kind not in VENUE_KINDS', () => {
    const result = venueCapabilitiesSchema.safeParse({
      kind: 'volcano',
      features: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'kind')).toBe(true)
    }
  })
})
