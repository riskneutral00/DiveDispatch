import { describe, it, expect } from 'vitest'
import {
  profileTabSchema,
  profileFromUser,
  profileToPayload,
  PROFILE_DEFAULTS,
  type ProfileValues,
} from '../profile-tab'

describe('profileFromUser', () => {
  it('maps a full user record to form state', () => {
    const user = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: 'JD',
      phone: '+1234567890',
      dateOfBirth: '1990-06-15',
      appLanguage: 'en',
    }

    const result = profileFromUser(user as Record<string, unknown>)

    expect(result).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: 'JD',
      phone: '+1234567890',
      dateOfBirth: '1990-06-15',
      appLanguage: 'en',
    })
  })

  it('maps missing optional fields to empty strings', () => {
    const user = {
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+1234567890',
    }

    const result = profileFromUser(user as Record<string, unknown>)

    expect(result).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      phone: '+1234567890',
      dateOfBirth: '',
      appLanguage: 'en',
    })
  })

  it('handles null/undefined fields gracefully', () => {
    const user = {
      firstName: null,
      lastName: undefined,
      nickname: undefined,
      phone: undefined,
      dateOfBirth: null,
    }

    const result = profileFromUser(user as Record<string, unknown>)

    expect(result).toEqual(PROFILE_DEFAULTS)
  })

  it('ignores malformed dateOfBirth strings', () => {
    const user = {
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      phone: '+1',
      dateOfBirth: 'not-a-date',
    }

    expect(profileFromUser(user as Record<string, unknown>).dateOfBirth).toBe('')
  })
})

describe('profileToPayload', () => {
  it('maps form state to mutation args with dateOfBirth', () => {
    const form: ProfileValues = {
      firstName: ' Jane ',
      lastName: ' Doe ',
      nickname: ' JD ',
      phone: ' +1234567890 ',
      dateOfBirth: '1990-06-15',
      appLanguage: 'en',
    }

    const result = profileToPayload(form)

    expect(result).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: 'JD',
      phone: '+1234567890',
      appLanguage: 'en',
      dateOfBirth: '1990-06-15',
    })
  })

  it('does not include a role field in the payload', () => {
    const form: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      phone: '+1234567890',
      dateOfBirth: '',
      appLanguage: 'en',
    }

    const result = profileToPayload(form)

    expect(result).not.toHaveProperty('role')
  })

  it('does not include businessName — that belongs on role-specific contact sections', () => {
    const form: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      phone: '+1234567890',
      dateOfBirth: '',
      appLanguage: 'en',
    }

    const result = profileToPayload(form)

    expect(result).not.toHaveProperty('businessName')
  })

  it('omits nickname when empty after trim', () => {
    const form: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '  ',
      phone: '+1234567890',
      dateOfBirth: '',
      appLanguage: 'en',
    }

    const result = profileToPayload(form)

    expect(result.nickname).toBeUndefined()
  })

  it('omits phone when empty after trim', () => {
    const form: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      phone: '  ',
      dateOfBirth: '',
      appLanguage: 'en',
    }

    const result = profileToPayload(form)

    expect(result.phone).toBeUndefined()
  })

  it('omits dateOfBirth when empty', () => {
    const form: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      phone: '+1234567890',
      dateOfBirth: '',
      appLanguage: 'en',
    }

    const result = profileToPayload(form)

    expect(result.dateOfBirth).toBeUndefined()
  })

  it('passes appLanguage from form state', () => {
    const form: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      phone: '+1234567890',
      dateOfBirth: '',
      appLanguage: 'th',
    }

    const result = profileToPayload(form)

    expect(result.appLanguage).toBe('th')
  })
})

describe('profileTabSchema', () => {
  it('accepts a valid form without any business/operator fields', () => {
    const valid: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      phone: '+12025551234',
      dateOfBirth: '',
      appLanguage: 'en',
    }

    expect(profileTabSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty firstName', () => {
    const invalid: ProfileValues = {
      firstName: '',
      lastName: 'Doe',
      nickname: '',
      phone: '+12025551234',
      dateOfBirth: '',
      appLanguage: 'en',
    }

    expect(profileTabSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects invalid phone number', () => {
    const invalid: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      phone: '123',
      dateOfBirth: '',
      appLanguage: 'en',
    }

    expect(profileTabSchema.safeParse(invalid).success).toBe(false)
  })

  it('accepts a valid ISO dateOfBirth', () => {
    const valid: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      phone: '+12025551234',
      dateOfBirth: '1990-06-15',
      appLanguage: 'en',
    }

    expect(profileTabSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects malformed dateOfBirth', () => {
    const invalid: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      phone: '+12025551234',
      dateOfBirth: '06/15/1990',
      appLanguage: 'en',
    }

    expect(profileTabSchema.safeParse(invalid).success).toBe(false)
  })
})
