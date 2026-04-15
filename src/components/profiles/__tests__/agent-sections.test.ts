import { describe, it, expect } from 'vitest'
import {
  agentContactSchema,
  agentLanguagesSchema,
  agentAssociationsSchema,
} from '@/lib/schemas/profile-shared'
import {
  contactFromProfile,
  contactToPayload,
  languagesFromProfileAgent,
  languagesToPayloadAgent,
  associationsFromProfile,
  associationsToPayload,
  INITIAL_CONTACT_FORM,
  INITIAL_LANGUAGES_FORM,
  INITIAL_ASSOCIATIONS_FORM,
} from '../agent-profile-form'
import type { AgentContactFormState, AgentAssociationsFormState } from '../agent-profile-form'

const VALID_LOCATION = {
  placeName: 'Koh Tao',
  country: 'Thailand',
  lat: 10.1,
  lng: 99.8,
}

describe('agentContactSchema', () => {
  const valid = {
    name: 'Scuba Bob Agency',
    location: VALID_LOCATION,
    email: 'bob@scubabob.com',
    phone: '+66 81 234 5678',
  }

  it('accepts a fully valid contact payload', () => {
    expect(agentContactSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects missing name', () => {
    expect(agentContactSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })

  it('rejects invalid email', () => {
    expect(agentContactSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects null location', () => {
    expect(agentContactSchema.safeParse({ ...valid, location: null }).success).toBe(false)
  })

  it('rejects missing phone', () => {
    expect(agentContactSchema.safeParse({ ...valid, phone: '' }).success).toBe(false)
  })

  it('does not require customerLanguages or associations', () => {
    expect(agentContactSchema.safeParse(valid).success).toBe(true)
  })
})

describe('agentLanguagesSchema', () => {
  it('accepts at least one language', () => {
    const data = { customerLanguages: [{ code: 'en', label: 'English' }] }
    expect(agentLanguagesSchema.safeParse(data).success).toBe(true)
  })

  it('rejects empty languages array', () => {
    const data = { customerLanguages: [] }
    expect(agentLanguagesSchema.safeParse(data).success).toBe(false)
  })
})

describe('agentAssociationsSchema', () => {
  it('accepts an empty associations array', () => {
    expect(agentAssociationsSchema.safeParse({ associations: [] }).success).toBe(true)
  })

  it('accepts a valid association', () => {
    const data = { associations: [{ agency: 'PADI', number: 'ABC123' }] }
    expect(agentAssociationsSchema.safeParse(data).success).toBe(true)
  })

  it('rejects association with missing agency', () => {
    const data = { associations: [{ agency: '', number: 'ABC123' }] }
    expect(agentAssociationsSchema.safeParse(data).success).toBe(false)
  })

  it('rejects association with missing number', () => {
    const data = { associations: [{ agency: 'PADI', number: '' }] }
    expect(agentAssociationsSchema.safeParse(data).success).toBe(false)
  })
})

describe('contactFromProfile', () => {
  it('extracts name, location, email, and phone', () => {
    const profile = {
      name: 'Scuba Bob Agency',
      placeName: 'Koh Tao',
      country: 'Thailand',
      lat: 10.1,
      lng: 99.8,
      email: 'bob@scubabob.com',
      phone: '+66 81 234 5678',
    }
    const form = contactFromProfile(profile)
    expect(form.name).toBe('Scuba Bob Agency')
    expect(form.email).toBe('bob@scubabob.com')
    expect(form.phone).toBe('+66 81 234 5678')
    expect(form.location?.placeName).toBe('Koh Tao')
    expect(form.location?.country).toBe('Thailand')
  })

  it('does not include associations; customerLanguages default to empty until merged with me', () => {
    const profile = {
      name: 'Agent',
      placeName: 'BKK',
      country: 'Thailand',
      lat: 13.7,
      lng: 100.5,
      email: 'a@b.com',
      phone: '+66 1',
      associations: [{ agency: 'PADI', number: 'X' }],
      customerLanguages: ['en'],
    }
    const form = contactFromProfile(profile)
    expect(form).not.toHaveProperty('associations')
    expect(form.customerLanguages).toEqual([])
  })
})

describe('contactToPayload', () => {
  it('produces expected shape with location fields flattened', () => {
    const form: AgentContactFormState = {
      name: 'Scuba Bob Agency',
      location: { placeName: 'Koh Tao', country: 'Thailand', lat: 10.1, lng: 99.8 },
      email: 'bob@scubabob.com',
      phone: '+66 81 234 5678',
      customerLanguages: [{ code: 'en', label: 'English' }],
      access: { mode: 'open', isAllowed: [], notAllowed: [] },
    }
    const payload = contactToPayload(form)
    expect(payload.name).toBe('Scuba Bob Agency')
    expect(payload.placeName).toBe('Koh Tao')
    expect(payload.country).toBe('Thailand')
    expect(payload.lat).toBe(10.1)
    expect(payload.lng).toBe(99.8)

    expect(payload.email).toBe('bob@scubabob.com')
    expect(payload.phone).toBe('+66 81 234 5678')
    expect(payload).not.toHaveProperty('defaultReferral')
  })

  it('does not include customerLanguages or associations', () => {
    const form: AgentContactFormState = {
      name: 'Agent',
      location: { placeName: 'BKK', country: 'TH', lat: 13.7, lng: 100.5 },
      email: 'a@b.com',
      phone: '+66 1',
      customerLanguages: [{ code: 'en', label: 'English' }],
      access: { mode: 'open', isAllowed: [], notAllowed: [] },
    }
    const payload = contactToPayload(form)
    expect(payload).not.toHaveProperty('associations')
    expect(payload).not.toHaveProperty('customerLanguages')
  })
})

describe('languagesFromProfileAgent', () => {
  it('reads customerLanguages from me (user record), not from agent profile', () => {
    const agentProfile = { name: 'Agent', associations: [] }
    const me = { customerLanguages: ['en'] }
    const form = languagesFromProfileAgent(agentProfile, me)
    expect(form.customerLanguages).toHaveLength(1)
    expect(form.customerLanguages[0].code).toBe('en-GB')
  })

  it('returns empty array when me has no customerLanguages', () => {
    const form = languagesFromProfileAgent({}, undefined)
    expect(form.customerLanguages).toEqual([])
  })

  it('does not read customerLanguages from agent profile even if present', () => {
    const profileWithLangs = { customerLanguages: ['ja'] }
    const me = { customerLanguages: ['en'] }
    const form = languagesFromProfileAgent(profileWithLangs, me)
    expect(form.customerLanguages).toHaveLength(1)
    expect(form.customerLanguages[0].code).toBe('en-GB')
  })
})

describe('languagesToPayloadAgent', () => {
  it('returns empty object (nothing to write to agents table)', () => {
    const payload = languagesToPayloadAgent({
      customerLanguages: [{ code: 'en', label: 'English' }],
    })
    expect(payload).toEqual({})
  })

  it('does not include customerLanguages in agents table payload', () => {
    const payload = languagesToPayloadAgent({
      customerLanguages: [{ code: 'en', label: 'English' }],
    })
    expect(payload).not.toHaveProperty('customerLanguages')
  })
})

describe('associationsFromProfile', () => {
  it('maps associations array from profile correctly', () => {
    const profile = {
      associations: [{ agency: 'PADI', number: 'PADI123' }],
    }
    const form = associationsFromProfile(profile)
    expect(form.associations).toHaveLength(1)
    expect(form.associations[0].agency).toBe('PADI')
    expect(form.associations[0].number).toBe('PADI123')
  })

  it('returns empty array when associations is missing', () => {
    const form = associationsFromProfile({})
    expect(form.associations).toEqual([])
  })

  it('returns empty array when associations is empty', () => {
    const form = associationsFromProfile({ associations: [] })
    expect(form.associations).toEqual([])
  })
})

describe('associationsToPayload', () => {
  it('sends only associations array', () => {
    const form: AgentAssociationsFormState = {
      associations: [{ agency: 'PADI', number: 'ABC' }],
    }
    const payload = associationsToPayload(form)
    expect(Object.keys(payload)).toEqual(['associations'])
    const assocs = payload.associations as Array<{ agency: string; number: string }>
    expect(assocs).toHaveLength(1)
    expect(assocs[0].agency).toBe('PADI')
    expect(assocs[0].number).toBe('ABC')
  })

  it('does not include contact or language fields', () => {
    const form: AgentAssociationsFormState = {
      associations: [],
    }
    const payload = associationsToPayload(form)
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

describe('INITIAL_LANGUAGES_FORM', () => {
  it('starts with empty customerLanguages', () => {
    expect(INITIAL_LANGUAGES_FORM.customerLanguages).toEqual([])
  })
})

describe('INITIAL_ASSOCIATIONS_FORM', () => {
  it('starts with empty associations array', () => {
    expect(INITIAL_ASSOCIATIONS_FORM.associations).toEqual([])
  })
})
