/**
 * profile-tab — fromProfile / toPayload mapping tests
 *
 * Unit tests for the pure mapping functions extracted from ProfileTab.
 * These verify that Convex user records are correctly mapped to form state
 * and that form state is correctly mapped to mutation payloads.
 */

import { describe, it, expect } from 'vitest'
import {
  profileTabSchema,
  profileFromUser,
  profileToPayload,
  PROFILE_DEFAULTS,
  type ProfileValues,
} from '../profile-tab'

// ── fromProfile ─────────────────────────────────────────────────────────────

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
      dobMonth: '06',
      dobDay: '15',
      dobYear: '1990',
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
      dobMonth: '',
      dobDay: '',
      dobYear: '',
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

  it('parses dateOfBirth components correctly for single-digit day', () => {
    const user = {
      firstName: 'A',
      lastName: 'B',
      businessName: 'C',
      email: 'a@b.com',
      phone: '+1',
      dateOfBirth: '2000-01-05',
    }

    const result = profileFromUser(user as Record<string, unknown>)

    expect(result.dobYear).toBe('2000')
    expect(result.dobMonth).toBe('01')
    expect(result.dobDay).toBe('05')
  })
})

// ── toPayload ───────────────────────────────────────────────────────────────

describe('profileToPayload', () => {
  it('maps form state to mutation args with full DOB', () => {
    const form: ProfileValues = {
      firstName: ' Jane ',
      lastName: ' Doe ',
      nickname: ' JD ',
      businessName: ' Ocean Corp ',
      email: ' jane@ocean.com ',
      phone: ' +1234567890 ',
      dobMonth: '06',
      dobDay: '15',
      dobYear: '1990',
    }

    const result = profileToPayload(form, 'en')

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
      dobMonth: '',
      dobDay: '',
      dobYear: '',
    }

    const result = profileToPayload(form, 'en')

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
      dobMonth: '',
      dobDay: '',
      dobYear: '',
    }

    const result = profileToPayload(form, 'en')

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
      dobMonth: '',
      dobDay: '',
      dobYear: '',
    }

    const result = profileToPayload(form, 'en')

    expect(result.phone).toBeUndefined()
  })

  it('omits dateOfBirth when any DOB component is empty', () => {
    const form: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
      phone: '+1234567890',
      dobMonth: '06',
      dobDay: '',
      dobYear: '1990',
    }

    const result = profileToPayload(form, 'en')

    expect(result.dateOfBirth).toBeUndefined()
  })

  it('passes appLanguage from user record', () => {
    const form: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
      phone: '+1234567890',
      dobMonth: '',
      dobDay: '',
      dobYear: '',
    }

    const result = profileToPayload(form, 'th')

    expect(result.appLanguage).toBe('th')
  })
})

// ── Schema validation ───────────────────────────────────────────────────────

describe('profileTabSchema', () => {
  it('accepts a valid form', () => {
    const valid: ProfileValues = {
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: '',
      businessName: 'Ocean Corp',
      email: 'jane@ocean.com',
      phone: '+12025551234',
      dobMonth: '',
      dobDay: '',
      dobYear: '',
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
      dobMonth: '',
      dobDay: '',
      dobYear: '',
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
      dobMonth: '',
      dobDay: '',
      dobYear: '',
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
      dobMonth: '',
      dobDay: '',
      dobYear: '',
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
      dobMonth: '',
      dobDay: '',
      dobYear: '',
    }

    expect(profileTabSchema.safeParse(invalid).success).toBe(false)
  })
})
