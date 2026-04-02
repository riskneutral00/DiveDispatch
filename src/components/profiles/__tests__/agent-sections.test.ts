/**
 * Agent profile form section tests.
 *
 * Tests schema validation, payload transformation, and profile-to-form mapping
 * for each of the three independent Agent profile sections.
 */

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

// ── agentContactSchema ────────────────────────────────────────────────────────

describe('agentContactSchema', () => {
  const valid = {
    name: 'Scuba Bob Agency',
    location: VALID_LOCATION,
    email: 'bob@scubabob.com',
    phone: '+66 81 234 5678',
    defaultReferralMode: 'independent',
  }

  it('accepts a fully valid contact payload', () => {
    expect(agentContactSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts referral mode "referral"', () => {
    expect(agentContactSchema.safeParse({ ...valid, defaultReferralMode: 'referral' }).success).toBe(true)
  })

  it('rejects unknown defaultReferralMode value', () => {
    expect(agentContactSchema.safeParse({ ...valid, defaultReferralMode: 'hybrid' }).success).toBe(false)
  })

  it('rejects missing defaultReferralMode', () => {
    const { defaultReferralMode: _rm, ...withoutMode } = valid
    expect(agentContactSchema.safeParse(withoutMode).success).toBe(false)
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
    // Contact section is isolated — should not care about other sections
    expect(agentContactSchema.safeParse(valid).success).toBe(true)
  })
})

// ── agentLanguagesSchema ──────────────────────────────────────────────────────

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

// ── agentAssociationsSchema ───────────────────────────────────────────────────

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

// ── contactFromProfile ────────────────────────────────────────────────────────

describe('contactFromProfile', () => {
  it('extracts name, location, email, phone, and defaultReferralMode', () => {
    const profile = {
      name: 'Scuba Bob Agency',
      placeName: 'Koh Tao',
      country: 'Thailand',
      lat: 10.1,
      lng: 99.8,
      email: 'bob@scubabob.com',
      phone: '+66 81 234 5678',
      defaultReferralMode: 'referral',
    }
    const form = contactFromProfile(profile)
    expect(form.name).toBe('Scuba Bob Agency')
    expect(form.email).toBe('bob@scubabob.com')
    expect(form.phone).toBe('+66 81 234 5678')
    expect(form.defaultReferralMode).toBe('referral')
    expect(form.location?.placeName).toBe('Koh Tao')
    expect(form.location?.country).toBe('Thailand')
  })

  it('defaults defaultReferralMode to "independent" when absent', () => {
    const profile = {
      name: 'Agent',
      placeName: 'BKK',
      country: 'Thailand',
      lat: 13.7,
      lng: 100.5,
      email: 'a@b.com',
      phone: '+66 1',
    }
    const form = contactFromProfile(profile)
    expect(form.defaultReferralMode).toBe('independent')
  })

  it('does not include customerLanguages or associations', () => {
    const profile = {
      name: 'Agent',
      placeName: 'BKK',
      country: 'Thailand',
      lat: 13.7,
      lng: 100.5,
      email: 'a@b.com',
      phone: '+66 1',
      defaultReferralMode: 'independent',
      associations: [{ agency: 'PADI', number: 'X' }],
      customerLanguages: ['en'],
    }
    const form = contactFromProfile(profile)
    expect(form).not.toHaveProperty('associations')
    expect(form).not.toHaveProperty('customerLanguages')
  })
})

// ── contactToPayload ──────────────────────────────────────────────────────────

describe('contactToPayload', () => {
  it('produces expected shape with location fields flattened and defaultReferralMode', () => {
    const form: AgentContactFormState = {
      name: 'Scuba Bob Agency',
      location: { placeName: 'Koh Tao', country: 'Thailand', lat: 10.1, lng: 99.8, placeId: 'abc' },
      email: 'bob@scubabob.com',
      phone: '+66 81 234 5678',
      defaultReferralMode: 'referral',
    }
    const payload = contactToPayload(form)
    expect(payload.name).toBe('Scuba Bob Agency')
    expect(payload.placeName).toBe('Koh Tao')
    expect(payload.country).toBe('Thailand')
    expect(payload.lat).toBe(10.1)
    expect(payload.lng).toBe(99.8)
    expect(payload.placeId).toBe('abc')
    expect(payload.email).toBe('bob@scubabob.com')
    expect(payload.phone).toBe('+66 81 234 5678')
    expect(payload.defaultReferralMode).toBe('referral')
  })

  it('does not include customerLanguages or associations', () => {
    const form: AgentContactFormState = {
      name: 'Agent',
      location: { placeName: 'BKK', country: 'TH', lat: 13.7, lng: 100.5 },
      email: 'a@b.com',
      phone: '+66 1',
      defaultReferralMode: 'independent',
    }
    const payload = contactToPayload(form)
    expect(payload).not.toHaveProperty('associations')
    expect(payload).not.toHaveProperty('customerLanguages')
  })
})

// ── languagesFromProfileAgent ─────────────────────────────────────────────────

describe('languagesFromProfileAgent', () => {
  it('reads customerLanguages from me (user record), not from agent profile', () => {
    // Agent profile has no customerLanguages — they live on the users table
    const agentProfile = { name: 'Agent', associations: [] }
    const me = { customerLanguages: ['en'] }
    const form = languagesFromProfileAgent(agentProfile, me)
    expect(form.customerLanguages).toHaveLength(1)
    // 'en' is normalised to canonical locale 'en-GB' by resolveLanguages
    expect(form.customerLanguages[0].code).toBe('en-GB')
  })

  it('returns empty array when me has no customerLanguages', () => {
    const form = languagesFromProfileAgent({}, undefined)
    expect(form.customerLanguages).toEqual([])
  })

  it('does not read customerLanguages from agent profile even if present', () => {
    // Ensures isolation: agent profile field is ignored in favour of me
    const profileWithLangs = { customerLanguages: ['ja'] }
    const me = { customerLanguages: ['en'] }
    const form = languagesFromProfileAgent(profileWithLangs, me)
    // Should reflect 'en' from me, not 'ja' from profile
    expect(form.customerLanguages).toHaveLength(1)
    expect(form.customerLanguages[0].code).toBe('en-GB')
  })
})

// ── languagesToPayloadAgent ───────────────────────────────────────────────────

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

// ── associationsFromProfile ───────────────────────────────────────────────────

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

// ── associationsToPayload ─────────────────────────────────────────────────────

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
    expect(payload).not.toHaveProperty('defaultReferralMode')
  })
})

// ── Initial form defaults ─────────────────────────────────────────────────────

describe('INITIAL_CONTACT_FORM', () => {
  it('has empty string defaults and independent referral mode', () => {
    expect(INITIAL_CONTACT_FORM.name).toBe('')
    expect(INITIAL_CONTACT_FORM.email).toBe('')
    expect(INITIAL_CONTACT_FORM.phone).toBe('')
    expect(INITIAL_CONTACT_FORM.location).toBeNull()
    expect(INITIAL_CONTACT_FORM.defaultReferralMode).toBe('independent')
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
