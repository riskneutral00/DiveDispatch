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
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
      phone: '+1234567890',
      dateOfBirth: '1990-06-15',
      appLanguage: 'en',
    }

    const result = profileFromUser(user as Record<string, unknown>)

    expect(result).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: 'JD',
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
      phone: '+1234567890',
      dateOfBirth: '1990-06-15',
      appLanguage: 'en',
    })
  })

  it('maps missing optional fields to empty strings', () => {
    const user = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@ocean.com',
      phone: '+1234567890',
      businessName: 'Ocean Corp',
    }

    const result = profileFromUser(user as Record<string, unknown>)

    expect(result).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
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
      businessName: null,
      email: null,
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
      businessName: 'C',
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
      businessName: ' Ocean Corp ',
      email: ' jane@ocean.com ',
      phone: ' +1234567890 ',
      dateOfBirth: '1990-06-15',
      appLanguage: 'en',
    }

    const result = profileToPayload(form)

    expect(result).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: 'JD',
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
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
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
      phone: '+1234567890',
      dateOfBirth: '',
      appLanguage: 'en',
    }

    const result = profileToPayload(form)

    expect(result).not.toHaveProperty('role')
  })

  it('omits nickname when empty after trim', () => {
    const form: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '  ',
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
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
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
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
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
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
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
      phone: '+1234567890',
      dateOfBirth: '',
      appLanguage: 'th',
    }

    const result = profileToPayload(form)

    expect(result.appLanguage).toBe('th')
  })
})

describe('profileTabSchema', () => {
  it('accepts a valid form', () => {
    const valid: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
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
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
      phone: '+12025551234',
      dateOfBirth: '',
      appLanguage: 'en',
    }

    expect(profileTabSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects invalid email', () => {
    const invalid: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      businessName: 'Ocean Corp',
      email: 'not-an-email',
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
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
      phone: '123',
      dateOfBirth: '',
      appLanguage: 'en',
    }

    expect(profileTabSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects empty businessName', () => {
    const invalid: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      businessName: '',
      email: 'jane@ocean.com',
      phone: '+12025551234',
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
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
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
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
      phone: '+12025551234',
      dateOfBirth: '06/15/1990',
      appLanguage: 'en',
    }

    expect(profileTabSchema.safeParse(invalid).success).toBe(false)
  })
})
