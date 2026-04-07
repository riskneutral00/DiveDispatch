import { describe, it, expect } from 'vitest'
import {
  personalContactSchema,
  personalLanguagesSchema,
  diveMasterCredentialsSchema,
  instructorCredentialsSchema,
} from '@/lib/schemas/profile-shared'
import {
  contactFromProfile,
  contactToPayload,
  INITIAL_CONTACT_FORM,
  type ContactFormState,
} from '@/lib/profile-form'
import {
  languagesFromProfilePersonal,
  languagesToPayloadPersonal,
  credentialsFromProfile,
  credentialsToPayload,
  makeEmptyDmCredential,
  makeEmptyInstCredential,
  INITIAL_LANGUAGES_FORM,
  INITIAL_DM_CREDENTIALS_FORM,
  INITIAL_INST_CREDENTIALS_FORM,
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
    name: 'Ariel Nemo',
    location: VALID_LOCATION,
    email: 'ariel@dive.com',
    phone: '+66 81 234 5678',
  }

  it('accepts a fully valid contact payload', () => {
    expect(personalContactSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects missing name', () => {
    expect(personalContactSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
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

describe('diveMasterCredentialsSchema', () => {
  const validDmCred = {
    agency: 'PADI',
    level: 'Divemaster',
    agencyID: 'DM12345',
  }

  it('accepts a valid divemaster credential', () => {
    expect(diveMasterCredentialsSchema.safeParse({ credential: [validDmCred] }).success).toBe(true)
  })

  it('rejects empty credential array', () => {
    expect(diveMasterCredentialsSchema.safeParse({ credential: [] }).success).toBe(false)
  })

  it('rejects credential with missing agency', () => {
    const bad = { ...validDmCred, agency: '' }
    expect(diveMasterCredentialsSchema.safeParse({ credential: [bad] }).success).toBe(false)
  })

  it('rejects credential with missing level', () => {
    const bad = { ...validDmCred, level: '' }
    expect(diveMasterCredentialsSchema.safeParse({ credential: [bad] }).success).toBe(false)
  })

  it('rejects credential with missing agencyID', () => {
    const bad = { ...validDmCred, agencyID: '' }
    expect(diveMasterCredentialsSchema.safeParse({ credential: [bad] }).success).toBe(false)
  })

  it('does not require courses field', () => {
    expect(diveMasterCredentialsSchema.safeParse({ credential: [validDmCred] }).success).toBe(true)
  })
})

describe('instructorCredentialsSchema', () => {
  const validInstCred = {
    agency: 'PADI',
    level: 'Open Water Scuba Instructor',
    agencyID: 'OWSI550453',
    specialtyRatings: ['Open Water', 'Advanced Open Water'],
  }

  it('accepts a valid instructor credential with specialtyRatings', () => {
    expect(instructorCredentialsSchema.safeParse({ credential: [validInstCred] }).success).toBe(true)
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

  it('accepts credential with empty specialtyRatings array', () => {
    const valid = { ...validInstCred, specialtyRatings: [] }
    expect(instructorCredentialsSchema.safeParse({ credential: [valid] }).success).toBe(true)
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

describe('credentialsFromProfile — divemaster variant', () => {
  it('maps credential array from profile for divemaster', () => {
    const profile = {
      credential: [{ agency: 'PADI', level: 'Divemaster', agencyID: 'DM12345' }],
    }
    const form = credentialsFromProfile(profile, 'divemaster')
    expect(form.credential).toHaveLength(1)
    expect(form.credential[0].agency).toBe('PADI')
    expect(form.credential[0].level).toBe('Divemaster')
    expect(form.credential[0].agencyID).toBe('DM12345')
  })

  it('returns one empty DM credential when array is empty', () => {
    const form = credentialsFromProfile({ credential: [] }, 'divemaster')
    expect(form.credential).toHaveLength(1)
    expect(form.credential[0]).toEqual(makeEmptyDmCredential())
  })

  it('returns one empty DM credential when credential is missing', () => {
    const form = credentialsFromProfile({}, 'divemaster')
    expect(form.credential).toHaveLength(1)
    expect(form.credential[0]).toEqual(makeEmptyDmCredential())
  })
})

describe('credentialsFromProfile — instructor variant', () => {
  it('maps credential array from profile for instructor', () => {
    const profile = {
      credential: [{ agency: 'PADI', level: 'OWSI', agencyID: '550453', specialtyRatings: ['Open Water'] }],
    }
    const form = credentialsFromProfile(profile, 'instructor')
    expect(form.credential).toHaveLength(1)
    expect(form.credential[0].agency).toBe('PADI')
    expect(form.credential[0].level).toBe('OWSI')
    expect(form.credential[0].agencyID).toBe('550453')
  })

  it('returns one empty instructor credential when array is empty', () => {
    const form = credentialsFromProfile({ credential: [] }, 'instructor')
    expect(form.credential).toHaveLength(1)
    expect(form.credential[0]).toEqual(makeEmptyInstCredential())
  })

  it('empty instructor credential has specialtyRatings: []', () => {
    const empty = makeEmptyInstCredential()
    expect(empty).toHaveProperty('specialtyRatings')
    expect(empty.specialtyRatings).toEqual([])
  })
})

describe('credentialsToPayload', () => {
  it('sends only credential array', () => {
    const form: PersonalCredentialsFormState = {
      credential: [{ agency: 'PADI', level: 'Divemaster', agencyID: 'DM123' }],
    }
    const payload = credentialsToPayload(form)
    expect(Object.keys(payload)).toEqual(['credential'])
    const creds = payload.credential as Array<{ agency: string; level: string; agencyID: string }>
    expect(creds).toHaveLength(1)
    expect(creds[0].agency).toBe('PADI')
  })

  it('does not include contact or language fields', () => {
    const form: PersonalCredentialsFormState = {
      credential: [],
    }
    const payload = credentialsToPayload(form)
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('teachingLanguages')
  })
})

describe('makeEmptyDmCredential', () => {
  it('has agency, level, agencyID as empty strings — no specialtyRatings field', () => {
    const cred = makeEmptyDmCredential()
    expect(cred.agency).toBe('')
    expect(cred.level).toBe('')
    expect(cred.agencyID).toBe('')
    expect(cred).not.toHaveProperty('specialtyRatings')
  })
})

describe('makeEmptyInstCredential', () => {
  it('has agency, level, agencyID as empty strings — specialtyRatings is empty array', () => {
    const cred = makeEmptyInstCredential()
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

describe('INITIAL_DM_CREDENTIALS_FORM', () => {
  it('starts with one empty DM credential', () => {
    expect(INITIAL_DM_CREDENTIALS_FORM.credential).toHaveLength(1)
    expect(INITIAL_DM_CREDENTIALS_FORM.credential[0]).toEqual(makeEmptyDmCredential())
  })
})

describe('INITIAL_INST_CREDENTIALS_FORM', () => {
  it('starts with one empty instructor credential (with specialtyRatings: [])', () => {
    expect(INITIAL_INST_CREDENTIALS_FORM.credential).toHaveLength(1)
    expect(INITIAL_INST_CREDENTIALS_FORM.credential[0]).toEqual(makeEmptyInstCredential())
  })
})
