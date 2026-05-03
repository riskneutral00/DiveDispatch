import { describe, it, expect } from 'vitest'
import {
  contactSchema,
  diveCenterLanguagesSchema,
  diveCenterAffiliationsSchema,
  makeDefaultDiveCenterAssociation as makeDefaultAssoc,
} from '@/lib/schemas/profile-shared'
import {
  contactFromProfile,
  contactToPayload,
  INITIAL_CONTACT_FORM,
  type ContactFormState,
} from '@/lib/profile-form'
import {
  affiliationsFromProfile,
  affiliationsToPayload,
  INITIAL_AFFILIATIONS_FORM,
} from '../dive-center-profile-form'
import type { DiveCenterAffiliationsFormState } from '../dive-center-profile-form'

const VALID_LOCATION = {
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.1,
  lng: 99.8,
}

describe('contactSchema', () => {
  const valid = {
    name: "Ms. Mermaids' DC",
    location: VALID_LOCATION,
    email: 'contact@mermaids.com',
    phone: '+66812345678',
  }

  it('accepts a fully valid contact payload', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects missing name', () => {
    expect(contactSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })

  it('rejects invalid email', () => {
    expect(contactSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects null location', () => {
    expect(contactSchema.safeParse({ ...valid, location: null }).success).toBe(false)
  })

  it('rejects missing phone', () => {
    expect(contactSchema.safeParse({ ...valid, phone: '' }).success).toBe(false)
  })

  it('does not require customerLanguages or associations', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true)
  })
})

describe('diveCenterLanguagesSchema', () => {
  it('accepts at least one language', () => {
    const data = { customerLanguages: [{ code: 'en', label: 'English' }] }
    expect(diveCenterLanguagesSchema.safeParse(data).success).toBe(true)
  })

  it('rejects empty languages array', () => {
    const data = { customerLanguages: [] }
    expect(diveCenterLanguagesSchema.safeParse(data).success).toBe(false)
  })
})

describe('diveCenterAffiliationsSchema', () => {
  function validAssoc(overrides: Partial<{
    agency: string
    number: string
    owDays: number
    aowDays: number
    oaDays: number
    selectedSpecialties: string[]
  }> = {}) {
    return {
      agency: 'PADI',
      number: 'ABC123',
      owDays: 3,
      aowDays: 2,
      oaDays: 4,
      selectedSpecialties: ['s1', 's2', 's3', 's4', 's5'],
      ...overrides,
    }
  }

  it('accepts exactly 5 specialties (boundary: passes)', () => {
    const data = { associations: [validAssoc({ selectedSpecialties: ['s1', 's2', 's3', 's4', 's5'] })] }
    expect(diveCenterAffiliationsSchema.safeParse(data).success).toBe(true)
  })

  it('rejects exactly 4 specialties (boundary: fails)', () => {
    const data = { associations: [validAssoc({ selectedSpecialties: ['s1', 's2', 's3', 's4'] })] }
    const result = diveCenterAffiliationsSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('accepts 6 specialties (above minimum)', () => {
    const data = { associations: [validAssoc({ selectedSpecialties: ['s1', 's2', 's3', 's4', 's5', 's6'] })] }
    expect(diveCenterAffiliationsSchema.safeParse(data).success).toBe(true)
  })

  it('rejects empty associations array', () => {
    const data = { associations: [] }
    expect(diveCenterAffiliationsSchema.safeParse(data).success).toBe(false)
  })

  it('rejects missing agency on an association item', () => {
    const data = { associations: [validAssoc({ agency: '' })] }
    expect(diveCenterAffiliationsSchema.safeParse(data).success).toBe(false)
  })

  it('rejects missing member ID on an association item', () => {
    const data = { associations: [validAssoc({ number: '' })] }
    expect(diveCenterAffiliationsSchema.safeParse(data).success).toBe(false)
  })

  it('does not require contact or language fields', () => {
    const data = { associations: [validAssoc()] }
    expect(diveCenterAffiliationsSchema.safeParse(data).success).toBe(true)
  })
})

describe('contactFromProfile', () => {
  it('extracts name, location, email, phone from profile', () => {
    const profile = {
      name: "Ms. Mermaids' DC",
      address: { city: 'Koh Tao', country: 'TH' },
      lat: 10.1,
      lng: 99.8,
      email: 'contact@mermaids.com',
      phone: '+66812345678',
    }
    const form = contactFromProfile(profile)
    expect(form.name).toBe("Ms. Mermaids' DC")
    expect(form.email).toBe('contact@mermaids.com')
    expect(form.phone).toBe('+66812345678')
    expect(form.location?.address.city).toBe('Koh Tao')
    expect(form.location?.address.country).toBe('TH')
  })

  it('does not include associations or customerLanguages', () => {
    const profile = {
      name: 'Test DC',
      address: { city: 'Bangkok', country: 'TH' },
      lat: 13.7,
      lng: 100.5,
      email: 'a@b.com',
      phone: '+6611111111',
      associations: [{ agency: 'PADI', number: 'X' }],
      customerLanguages: ['en'],
    }
    const form = contactFromProfile(profile)
    expect(form).not.toHaveProperty('associations')
    expect(form).not.toHaveProperty('customerLanguages')
  })
})

describe('contactToPayload', () => {
  it('produces expected shape with location fields flattened', () => {
    const form: ContactFormState = {
      name: "Ms. Mermaids' DC",
      location: { address: { city: 'Koh Tao', country: 'TH' }, lat: 10.1, lng: 99.8 },
      email: 'contact@mermaids.com',
      phone: '+66812345678',
    }
    const payload = contactToPayload(form)
    expect(payload.name).toBe("Ms. Mermaids' DC")
    expect(payload.address).toEqual({ city: 'Koh Tao', country: 'TH' })
    expect(payload.lat).toBe(10.1)
    expect(payload.lng).toBe(99.8)

    expect(payload.email).toBe('contact@mermaids.com')
    expect(payload.phone).toBe('+66812345678')
    expect(payload).not.toHaveProperty('placeName')
  })

  it('does not include associations or customerLanguages', () => {
    const form: ContactFormState = {
      name: 'Test',
      location: { address: { city: 'BKK', country: 'TH' }, lat: 13.7, lng: 100.5 },
      email: 'a@b.com',
      phone: '+6611111111',
    }
    const payload = contactToPayload(form)
    expect(payload).not.toHaveProperty('associations')
    expect(payload).not.toHaveProperty('customerLanguages')
  })
})

describe('affiliationsFromProfile', () => {
  it('maps associations array from profile correctly', () => {
    const profile = {
      associations: [
        {
          agency: 'PADI',
          number: 'PADI123',
          owDays: 4,
          aowDays: 3,
          oaDays: 5,
          selectedSpecialties: ['Wreck', 'Deep', 'Night', 'Underwater Navigation', 'Search and Recovery'],
        },
      ],
    }
    const form = affiliationsFromProfile(profile)
    expect(form.associations).toHaveLength(1)
    expect(form.associations[0].agency).toBe('PADI')
    expect(form.associations[0].number).toBe('PADI123')
    expect(form.associations[0].owDays).toBe(4)
    expect(form.associations[0].selectedSpecialties).toHaveLength(5)
    expect(form.associations[0].selectedSpecialties[0]).toBe('Wreck')
  })

  it('defaults to one blank assoc when associations is empty', () => {
    const form = affiliationsFromProfile({ associations: [] })
    expect(form.associations).toHaveLength(1)
    expect(form.associations[0].agency).toBe('')
    expect(form.associations[0].selectedSpecialties).toEqual([])
  })

  it('defaults to one blank assoc when associations is missing', () => {
    const form = affiliationsFromProfile({})
    expect(form.associations).toHaveLength(1)
    expect(form.associations[0]).toEqual(makeDefaultAssoc())
  })

  it('returns undefined for days when omitted from profile', () => {
    const profile = {
      associations: [{ agency: 'SSI', number: 'SSI456' }],
    }
    const form = affiliationsFromProfile(profile)
    expect(form.associations[0].owDays).toBeUndefined()
    expect(form.associations[0].aowDays).toBeUndefined()
    expect(form.associations[0].oaDays).toBeUndefined()
    expect(form.associations[0].selectedSpecialties).toEqual([])
  })
})

describe('affiliationsToPayload', () => {
  it('serialises all association fields', () => {
    const form: DiveCenterAffiliationsFormState = {
      associations: [
        {
          agency: 'PADI',
          number: 'ABC',
          owDays: 3,
          aowDays: 2,
          oaDays: 4,
          selectedSpecialties: ['Wreck', 'Deep'],
        },
      ],
    }
    const payload = affiliationsToPayload(form)
    const assoc = (payload.associations as Array<Record<string, unknown>>)[0]
    expect(assoc.agency).toBe('PADI')
    expect(assoc.number).toBe('ABC')
    expect(assoc.owDays).toBe(3)
    expect(assoc.selectedSpecialties).toEqual(['Wreck', 'Deep'])
  })

  it('does not include contact fields', () => {
    const form: DiveCenterAffiliationsFormState = {
      associations: [makeDefaultAssoc()],
    }
    const payload = affiliationsToPayload(form)
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('customerLanguages')
  })
})

describe('INITIAL_CONTACT_FORM', () => {
  it('has empty string defaults', () => {
    expect(INITIAL_CONTACT_FORM.name).toBe('')
    expect(INITIAL_CONTACT_FORM.email).toBe('')
    expect(INITIAL_CONTACT_FORM.phone).toBe('')
    expect(INITIAL_CONTACT_FORM.location).toBeNull()
  })
})

describe('makeDefaultAssoc', () => {
  it('returns undefined for owDays, aowDays, oaDays so new cards show empty day pickers', () => {
    const assoc = makeDefaultAssoc()
    expect(assoc.owDays).toBeUndefined()
    expect(assoc.aowDays).toBeUndefined()
    expect(assoc.oaDays).toBeUndefined()
  })

  it('returns empty string for agency and number', () => {
    const assoc = makeDefaultAssoc()
    expect(assoc.agency).toBe('')
    expect(assoc.number).toBe('')
    expect(assoc.selectedSpecialties).toEqual([])
  })
})

describe('INITIAL_AFFILIATIONS_FORM', () => {
  it('starts with one blank association', () => {
    expect(INITIAL_AFFILIATIONS_FORM.associations).toHaveLength(1)
    expect(INITIAL_AFFILIATIONS_FORM.associations[0]).toEqual(makeDefaultAssoc())
  })
})

