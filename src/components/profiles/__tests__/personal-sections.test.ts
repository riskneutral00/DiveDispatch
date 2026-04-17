import { describe, it, expect } from 'vitest'
import {
  personalContactSchema,
  personalLanguagesSchema,
  instructorCredentialsSchema,
} from '@/lib/schemas/profile-shared'
import {
  contactFromProfile,
  contactToPayload,
  personalContactFromProfile,
  personalContactToPayload,
  INITIAL_CONTACT_FORM,
  INITIAL_PERSONAL_CONTACT_FORM,
  type ContactFormState,
  type PersonalContactFormState,
} from '@/lib/profile-form'
import {
  languagesFromProfilePersonal,
  languagesToPayloadPersonal,
  credentialsFromProfile,
  credentialsToPayload,
  makeEmptyCredential,
  getInitialCredentialsForm,
  INITIAL_LANGUAGES_FORM,
} from '../personal-profile-form'
import type {
  PersonalLanguagesFormState,
  PersonalCredentialsFormState,
} from '../personal-profile-form'

const VALID_LOCATION = {
  placeName: 'Koh Tao',
  country: 'Thailand',
  lat: 10.1,
  lng: 99.8,
}

describe('personalContactSchema', () => {
  const valid = {
    location: VALID_LOCATION,
    email: 'ariel@dive.com',
    phone: '+66 81 234 5678',
  }

  it('accepts a fully valid contact payload', () => {
    expect(personalContactSchema.safeParse(valid).success).toBe(true)
  })

  it('ignores name when provided (derived server-side)', () => {
    const parsed = personalContactSchema.safeParse({ ...valid, name: 'Ariel Nemo' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('name')
    }
  })

  it('rejects invalid email', () => {
    expect(personalContactSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects null location', () => {
    expect(personalContactSchema.safeParse({ ...valid, location: null }).success).toBe(false)
  })

  it('rejects missing phone', () => {
    expect(personalContactSchema.safeParse({ ...valid, phone: '' }).success).toBe(false)
  })

  it('does not require credentials or languages', () => {
    expect(personalContactSchema.safeParse(valid).success).toBe(true)
  })
})

describe('personalContactFromProfile', () => {
  it('extracts location, email, phone — omits name', () => {
    const profile = {
      name: 'Ariel Nemo',
      placeName: 'Koh Tao',
      country: 'Thailand',
      lat: 10.1,
      lng: 99.8,
      email: 'ariel@dive.com',
      phone: '+66 81 234 5678',
    }
    const form = personalContactFromProfile(profile)
    expect(form).not.toHaveProperty('name')
    expect(form.email).toBe('ariel@dive.com')
    expect(form.phone).toBe('+66 81 234 5678')
    expect(form.location?.placeName).toBe('Koh Tao')
  })
})

describe('personalContactToPayload', () => {
  it('produces expected shape without name', () => {
    const form: PersonalContactFormState = {
      location: { placeName: 'Koh Tao', country: 'Thailand', lat: 10.1, lng: 99.8 },
      email: 'ariel@dive.com',
      phone: '+66 81 234 5678',
    }
    const payload = personalContactToPayload(form)
    expect(payload).not.toHaveProperty('name')
    expect(payload.placeName).toBe('Koh Tao')
    expect(payload.country).toBe('Thailand')
    expect(payload.email).toBe('ariel@dive.com')
    expect(payload.phone).toBe('+66 81 234 5678')
  })
})

describe('INITIAL_PERSONAL_CONTACT_FORM', () => {
  it('has no name, empty email/phone, null location', () => {
    expect(INITIAL_PERSONAL_CONTACT_FORM).not.toHaveProperty('name')
    expect(INITIAL_PERSONAL_CONTACT_FORM.email).toBe('')
    expect(INITIAL_PERSONAL_CONTACT_FORM.phone).toBe('')
    expect(INITIAL_PERSONAL_CONTACT_FORM.location).toBeNull()
  })
})

describe('personalLanguagesSchema', () => {
  it('accepts at least one teaching language', () => {
    const data = { teachingLanguages: [{ code: 'en', label: 'English' }] }
    expect(personalLanguagesSchema.safeParse(data).success).toBe(true)
  })

  it('rejects empty teachingLanguages array', () => {
    const data = { teachingLanguages: [] }
    expect(personalLanguagesSchema.safeParse(data).success).toBe(false)
  })
})

describe('instructorCredentialsSchema', () => {
  const validInstCred = {
    agency: 'PADI',
    level: 'OWSI',
    agencyID: 'OWSI550453',
    specialtyRatings: ['Open Water', 'Advanced Open Water'],
  }

  const validDmCred = {
    agency: 'PADI',
    level: 'DM',
    agencyID: 'DM12345',
    specialtyRatings: [],
  }

  it('accepts a valid instructor credential with specialtyRatings', () => {
    expect(instructorCredentialsSchema.safeParse({ credential: [validInstCred] }).success).toBe(true)
  })

  it('accepts a DM-level credential with empty specialtyRatings', () => {
    expect(instructorCredentialsSchema.safeParse({ credential: [validDmCred] }).success).toBe(true)
  })

  it('rejects empty credential array', () => {
    expect(instructorCredentialsSchema.safeParse({ credential: [] }).success).toBe(false)
  })

  it('rejects credential with missing agency', () => {
    const bad = { ...validInstCred, agency: '' }
    expect(instructorCredentialsSchema.safeParse({ credential: [bad] }).success).toBe(false)
  })

  it('rejects credential with missing level', () => {
    const bad = { ...validInstCred, level: '' }
    expect(instructorCredentialsSchema.safeParse({ credential: [bad] }).success).toBe(false)
  })

  it('rejects credential with missing agencyID', () => {
    const bad = { ...validInstCred, agencyID: '' }
    expect(instructorCredentialsSchema.safeParse({ credential: [bad] }).success).toBe(false)
  })

  it('rejects credential without specialtyRatings field', () => {
    const { specialtyRatings: _specialtyRatings, ...withoutSpecialtyRatings } = validInstCred
    expect(instructorCredentialsSchema.safeParse({ credential: [withoutSpecialtyRatings] }).success).toBe(false)
  })
})

describe('contactFromProfile', () => {
  it('extracts name, location, email, and phone from profile', () => {
    const profile = {
      name: 'Ariel Nemo',
      placeName: 'Koh Tao',
      country: 'Thailand',
      lat: 10.1,
      lng: 99.8,
      email: 'ariel@dive.com',
      phone: '+66 81 234 5678',
    }
    const form = contactFromProfile(profile)
    expect(form.name).toBe('Ariel Nemo')
    expect(form.email).toBe('ariel@dive.com')
    expect(form.phone).toBe('+66 81 234 5678')
    expect(form.location?.placeName).toBe('Koh Tao')
    expect(form.location?.country).toBe('Thailand')
  })

  it('does not include credentials or teachingLanguages', () => {
    const profile = {
      name: 'Test Instructor',
      placeName: 'Bangkok',
      country: 'Thailand',
      lat: 13.7,
      lng: 100.5,
      email: 'a@b.com',
      phone: '+66 1',
      credential: [{ agency: 'PADI', level: 'OWSI', agencyID: '123', specialtyRatings: [] }],
      teachingLanguages: ['en'],
    }
    const form = contactFromProfile(profile)
    expect(form).not.toHaveProperty('credential')
    expect(form).not.toHaveProperty('teachingLanguages')
  })
})

describe('contactToPayload', () => {
  it('produces expected shape with location fields flattened', () => {
    const form: ContactFormState = {
      name: 'Ariel Nemo',
      location: { placeName: 'Koh Tao', country: 'Thailand', lat: 10.1, lng: 99.8 },
      email: 'ariel@dive.com',
      phone: '+66 81 234 5678',
    }
    const payload = contactToPayload(form)
    expect(payload.name).toBe('Ariel Nemo')
    expect(payload.placeName).toBe('Koh Tao')
    expect(payload.country).toBe('Thailand')
    expect(payload.lat).toBe(10.1)
    expect(payload.lng).toBe(99.8)

    expect(payload.email).toBe('ariel@dive.com')
    expect(payload.phone).toBe('+66 81 234 5678')
  })

  it('does not include credentials or teachingLanguages', () => {
    const form: ContactFormState = {
      name: 'Test',
      location: { placeName: 'BKK', country: 'TH', lat: 13.7, lng: 100.5 },
      email: 'a@b.com',
      phone: '+66 1',
    }
    const payload = contactToPayload(form)
    expect(payload).not.toHaveProperty('credential')
    expect(payload).not.toHaveProperty('teachingLanguages')
  })
})

describe('languagesFromProfilePersonal', () => {
  it('resolves teachingLanguages codes to Language objects', () => {
    const form = languagesFromProfilePersonal({ teachingLanguages: ['en'] })
    expect(form.teachingLanguages).toHaveLength(1)
    expect(form.teachingLanguages[0].code).toBe('en-GB')
  })

  it('returns empty array when teachingLanguages is absent', () => {
    const form = languagesFromProfilePersonal({})
    expect(form.teachingLanguages).toEqual([])
  })
})

describe('languagesToPayloadPersonal', () => {
  it('maps Language objects back to code strings', () => {
    const form: PersonalLanguagesFormState = {
      teachingLanguages: [{ code: 'en', label: 'English' }],
    }
    const payload = languagesToPayloadPersonal(form)
    expect(payload.teachingLanguages).toEqual(['en'])
  })

  it('does not include contact or credential fields', () => {
    const form: PersonalLanguagesFormState = { teachingLanguages: [] }
    const payload = languagesToPayloadPersonal(form)
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('credential')
  })
})

describe('credentialsFromProfile', () => {
  it('maps credential array from profile', () => {
    const profile = {
      credential: [{ agency: 'PADI', level: 'OWSI', agencyID: '550453', specialtyRatings: ['Open Water'] }],
    }
    const form = credentialsFromProfile(profile)
    expect(form.credential).toHaveLength(1)
    expect(form.credential[0].agency).toBe('PADI')
    expect(form.credential[0].level).toBe('OWSI')
    expect(form.credential[0].agencyID).toBe('550453')
  })

  it('maps DM-level credential unchanged', () => {
    const profile = {
      credential: [{ agency: 'PADI', level: 'DM', agencyID: 'DM12345', specialtyRatings: [] }],
    }
    const form = credentialsFromProfile(profile)
    expect(form.credential).toHaveLength(1)
    expect(form.credential[0].agency).toBe('PADI')
    expect(form.credential[0].level).toBe('DM')
    expect(form.credential[0].agencyID).toBe('DM12345')
  })

  it('returns one empty credential when array is empty', () => {
    const form = credentialsFromProfile({ credential: [] })
    expect(form.credential).toHaveLength(1)
    expect(form.credential[0]).toEqual(makeEmptyCredential())
  })

  it('returns one empty credential when credential is missing', () => {
    const form = credentialsFromProfile({})
    expect(form.credential).toHaveLength(1)
    expect(form.credential[0]).toEqual(makeEmptyCredential())
  })

  it('empty credential has specialtyRatings: []', () => {
    const empty = makeEmptyCredential()
    expect(empty).toHaveProperty('specialtyRatings')
    expect(empty.specialtyRatings).toEqual([])
  })
})

describe('credentialsToPayload', () => {
  it('sends credential array + nitroxCertified', () => {
    const form: PersonalCredentialsFormState = {
      credential: [{ agency: 'PADI', level: 'DM', agencyID: 'DM123', specialtyRatings: [] }],
      nitroxCertified: false,
    }
    const payload = credentialsToPayload(form)
    expect(new Set(Object.keys(payload))).toEqual(new Set(['credential', 'nitroxCertified']))
    const creds = payload.credential as Array<{ agency: string; level: string; agencyID: string }>
    expect(creds).toHaveLength(1)
    expect(creds[0].agency).toBe('PADI')
    expect(payload.nitroxCertified).toBe(false)
  })

  it('does not include contact or language fields', () => {
    const form: PersonalCredentialsFormState = {
      credential: [],
      nitroxCertified: false,
    }
    const payload = credentialsToPayload(form)
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('teachingLanguages')
  })

  it('preserves specialtyRatings', () => {
    const form: PersonalCredentialsFormState = {
      credential: [
        {
          agency: 'PADI',
          level: 'OWSI',
          agencyID: 'INS-1',
          specialtyRatings: ['Nitrox', 'DeepDiver'],
        },
      ],
      nitroxCertified: true,
    }
    const payload = credentialsToPayload(form)
    const creds = payload.credential as Array<Record<string, unknown>>
    expect(creds[0].specialtyRatings).toEqual(['Nitrox', 'DeepDiver'])
    expect(payload.nitroxCertified).toBe(true)
  })
})

describe('makeEmptyCredential', () => {
  it('has agency, level, agencyID as empty strings — specialtyRatings is empty array', () => {
    const cred = makeEmptyCredential()
    expect(cred.agency).toBe('')
    expect(cred.level).toBe('')
    expect(cred.agencyID).toBe('')
    expect(cred.specialtyRatings).toEqual([])
  })
})

describe('INITIAL_CONTACT_FORM', () => {
  it('has empty string defaults and null location', () => {
    expect(INITIAL_CONTACT_FORM.name).toBe('')
    expect(INITIAL_CONTACT_FORM.email).toBe('')
    expect(INITIAL_CONTACT_FORM.phone).toBe('')
    expect(INITIAL_CONTACT_FORM.location).toBeNull()
  })
})

describe('INITIAL_LANGUAGES_FORM', () => {
  it('starts with empty teachingLanguages', () => {
    expect(INITIAL_LANGUAGES_FORM.teachingLanguages).toEqual([])
  })
})

describe('getInitialCredentialsForm', () => {
  it('starts with one empty instructor credential (with specialtyRatings: [])', () => {
    const form = getInitialCredentialsForm()
    expect(form.credential).toHaveLength(1)
    expect(form.credential[0]).toEqual(makeEmptyCredential())
  })
})
