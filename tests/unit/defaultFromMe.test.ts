// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { defaultFromMe } from '@/lib/profile-form/location'

describe('defaultFromMe', () => {
  it('seeds email + phone from user; ignores other keys', () => {
    const result = defaultFromMe(
      { email: 'r@test.com', phone: '+66123' },
      { name: 'X', email: '', phone: '', other: 'untouched' },
    )
    expect(result.email).toBe('r@test.com')
    expect(result.phone).toBe('+66123')
    expect(result.name).toBe('X')
    expect(result.other).toBe('untouched')
  })

  describe('languageKey option', () => {
    it('defaults customerLanguages to [appLanguage] when array is empty', () => {
      const result = defaultFromMe(
        { email: '', phone: '', appLanguage: 'en' },
        { customerLanguages: [] as unknown[] },
        { languageKey: 'customerLanguages' },
      )
      expect(result.customerLanguages).toEqual([{ code: 'en-GB', label: 'English' }])
    })

    it('defaults teachingLanguages to [appLanguage] when array is empty', () => {
      const result = defaultFromMe(
        { email: '', phone: '', appLanguage: 'th' },
        { teachingLanguages: [] as unknown[] },
        { languageKey: 'teachingLanguages' },
      )
      expect(result.teachingLanguages).toEqual([{ code: 'th-TH', label: 'Thai' }])
    })

    it('uses Chinese script label for zh-CN', () => {
      const result = defaultFromMe(
        { email: '', phone: '', appLanguage: 'zh-CN' },
        { customerLanguages: [] as unknown[] },
        { languageKey: 'customerLanguages' },
      )
      expect(result.customerLanguages).toEqual([{ code: 'zh-CN', label: '简体' }])
    })

    it('uses Chinese script label for zh-TW', () => {
      const result = defaultFromMe(
        { email: '', phone: '', appLanguage: 'zh-TW' },
        { customerLanguages: [] as unknown[] },
        { languageKey: 'customerLanguages' },
      )
      expect(result.customerLanguages).toEqual([{ code: 'zh-TW', label: '繁體' }])
    })

    it('does not override a non-empty array (respects user prior input)', () => {
      const existing = [{ code: 'fr-FR', label: 'French' }]
      const result = defaultFromMe(
        { email: '', phone: '', appLanguage: 'en' },
        { customerLanguages: existing as unknown[] },
        { languageKey: 'customerLanguages' },
      )
      expect(result.customerLanguages).toEqual(existing)
    })

    it('no-op when appLanguage is missing', () => {
      const result = defaultFromMe(
        { email: '', phone: '' },
        { customerLanguages: [] as unknown[] },
        { languageKey: 'customerLanguages' },
      )
      expect(result.customerLanguages).toEqual([])
    })

    it('no-op when languageKey option is omitted', () => {
      const result = defaultFromMe(
        { email: '', phone: '', appLanguage: 'en' },
        { customerLanguages: [] as unknown[] },
      )
      expect(result.customerLanguages).toEqual([])
    })
  })
})
