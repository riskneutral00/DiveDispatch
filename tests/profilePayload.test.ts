import { describe, it, expect } from 'vitest'
import {
  profileToPayload,
  profileFromUser,
  PROFILE_DEFAULTS,
  type ProfileValues,
} from '../src/components/settings/profile-tab'

describe('profileFromUser', () => {
  it('extracts all fields from a user record', () => {
    const result = profileFromUser({
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: 'JD',
      businessName: 'Blue Ocean',
      email: 'jane@test.com',
      phone: '+66812345678',
      dateOfBirth: '1990-06-15',
    })
    expect(result).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      nickname: 'JD',
      businessName: 'Blue Ocean',
      email: 'jane@test.com',
      phone: '+66812345678',
      dobMonth: '06',
      dobDay: '15',
      dobYear: '1990',
    })
  })

  it('defaults missing fields to empty strings', () => {
    const result = profileFromUser({})
    expect(result).toEqual(PROFILE_DEFAULTS)
  })

  it('handles null dateOfBirth', () => {
    const result = profileFromUser({ dateOfBirth: null })
    expect(result.dobMonth).toBe('')
    expect(result.dobDay).toBe('')
    expect(result.dobYear).toBe('')
  })

  it('handles non-string values gracefully', () => {
    const result = profileFromUser({
      firstName: 42,
      email: undefined,
      phone: true,
    })
    expect(result.firstName).toBe('')
    expect(result.email).toBe('')
    expect(result.phone).toBe('')
  })
})

describe('profileToPayload', () => {
  const fullForm: ProfileValues = {
    firstName: '  Jane  ',
    lastName: '  Doe  ',
    nickname: '  JD  ',
    businessName: '  Blue Ocean  ',
    email: '  jane@test.com  ',
    phone: '  +66812345678  ',
    dobMonth: '06',
    dobDay: '15',
    dobYear: '1990',
  }

  it('trims all string fields', () => {
    const payload = profileToPayload(fullForm, 'en')
    expect(payload.firstName).toBe('Jane')
    expect(payload.lastName).toBe('Doe')
    expect(payload.businessName).toBe('Blue Ocean')
    expect(payload.email).toBe('jane@test.com')
  })

  it('builds dateOfBirth from dob parts', () => {
    const payload = profileToPayload(fullForm, 'en')
    expect(payload.dateOfBirth).toBe('1990-06-15')
  })

  it('sets dateOfBirth to undefined when parts are missing', () => {
    const payload = profileToPayload({ ...fullForm, dobYear: '' }, 'en')
    expect(payload.dateOfBirth).toBeUndefined()
  })

  it('sets nickname to undefined when empty after trim', () => {
    const payload = profileToPayload({ ...fullForm, nickname: '   ' }, 'en')
    expect(payload.nickname).toBeUndefined()
  })

  it('passes appLanguage through', () => {
    const payload = profileToPayload(fullForm, 'th-TH')
    expect(payload.appLanguage).toBe('th-TH')
  })

  it('sets phone to undefined when empty after trim', () => {
    const payload = profileToPayload({ ...fullForm, phone: '   ' }, 'en')
    expect(payload.phone).toBeUndefined()
  })
})
