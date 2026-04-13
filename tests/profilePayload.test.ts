import { describe, it, expect } from 'vitest'
import {
  profileToPayload,
  profileFromUser,
  PROFILE_DEFAULTS,
  type ProfileValues,
} from '../src/components/account/profile-tab'

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
      dateOfBirth: '1990-06-15',
      appLanguage: 'en',
    })
  })

  it('defaults missing fields to empty strings', () => {
    const result = profileFromUser({})
    expect(result).toEqual(PROFILE_DEFAULTS)
  })

  it('handles null dateOfBirth', () => {
    const result = profileFromUser({ dateOfBirth: null })
    expect(result.dateOfBirth).toBe('')
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
    dateOfBirth: '1990-06-15',
    appLanguage: 'en',
  }

  it('trims all string fields', () => {
    const payload = profileToPayload(fullForm)
    expect(payload.firstName).toBe('Jane')
    expect(payload.lastName).toBe('Doe')
    expect(payload.businessName).toBe('Blue Ocean')
    expect(payload.email).toBe('jane@test.com')
  })

  it('passes dateOfBirth through', () => {
    const payload = profileToPayload(fullForm)
    expect(payload.dateOfBirth).toBe('1990-06-15')
  })

  it('sets dateOfBirth to undefined when empty', () => {
    const payload = profileToPayload({ ...fullForm, dateOfBirth: '' })
    expect(payload.dateOfBirth).toBeUndefined()
  })

  it('sets nickname to undefined when empty after trim', () => {
    const payload = profileToPayload({ ...fullForm, nickname: '   ' })
    expect(payload.nickname).toBeUndefined()
  })

  it('passes appLanguage through', () => {
    const payload = profileToPayload({ ...fullForm, appLanguage: 'th-TH' })
    expect(payload.appLanguage).toBe('th-TH')
  })

  it('sets phone to undefined when empty after trim', () => {
    const payload = profileToPayload({ ...fullForm, phone: '   ' })
    expect(payload.phone).toBeUndefined()
  })
})
