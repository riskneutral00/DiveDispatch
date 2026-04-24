import { describe, it, expect } from 'vitest'
import {
  agentContactSchema,
  agentLanguagesSchema,
  agentAssociationsSchema,
} from '@/lib/schemas/profile-shared'
import {
  associationsFromProfile,
  associationsToPayload,
  INITIAL_LANGUAGES_FORM,
  INITIAL_ASSOCIATIONS_FORM,
} from '../agent-profile-form'
import type { AgentAssociationsFormState } from '../agent-profile-form'

const VALID_LOCATION = {
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.1,
  lng: 99.8,
}

describe('agentContactSchema', () => {
  const valid = {
    name: 'Scuba Bob Agency',
    location: VALID_LOCATION,
    email: 'bob@scubabob.com',
    phone: '+66812345678',
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

  it('strips unknown fields (e.g. legacy _key) from list items', () => {
    const form = {
      associations: [
        { _key: 'item-legacy-1', agency: 'PADI', number: 'ABC' } as unknown as AgentAssociationsFormState['associations'][number],
      ],
    } as AgentAssociationsFormState
    const payload = associationsToPayload(form)
    const assocs = payload.associations as Array<Record<string, unknown>>
    expect(assocs[0]).not.toHaveProperty('_key')
    expect(assocs[0]).toEqual({ agency: 'PADI', number: 'ABC' })
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
