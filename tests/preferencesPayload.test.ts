import { describe, it, expect } from 'vitest'
import {
  preferencesToPayload,
  preferencesFromUser,
  PREFERENCES_DEFAULTS,
} from '../src/components/account/preferences-tab'

describe('preferencesFromUser', () => {
  it('extracts appLanguage from user record', () => {
    const result = preferencesFromUser({ appLanguage: 'th-TH' })
    expect(result.appLanguage).toBe('th-TH')
  })

  it('defaults to en when appLanguage is missing', () => {
    const result = preferencesFromUser({})
    expect(result.appLanguage).toBe('en')
  })

  it('defaults to en when appLanguage is non-string', () => {
    const result = preferencesFromUser({ appLanguage: 42 })
    expect(result.appLanguage).toBe('en')
  })

  it('defaults to en when appLanguage is empty string', () => {
    const result = preferencesFromUser({ appLanguage: '' })
    expect(result.appLanguage).toBe('en')
  })

  it('matches PREFERENCES_DEFAULTS for empty input', () => {
    expect(preferencesFromUser({})).toEqual(PREFERENCES_DEFAULTS)
  })
})

describe('preferencesToPayload', () => {
  it('passes appLanguage through', () => {
    expect(preferencesToPayload({ appLanguage: 'ja-JP' })).toEqual({
      appLanguage: 'ja-JP',
    })
  })

  it('handles default value', () => {
    expect(preferencesToPayload(PREFERENCES_DEFAULTS)).toEqual({
      appLanguage: 'en',
    })
  })
})
