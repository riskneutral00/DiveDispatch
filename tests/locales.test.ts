import { describe, it, expect } from 'vitest'
import {
  resolveLocale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
} from '../src/lib/constants/locales'

describe('resolveLocale', () => {
  it('returns cookie value when it is a supported locale', () => {
    expect(resolveLocale('zh-CN', undefined)).toBe('zh-CN')
  })

  it('ignores unsupported cookie value', () => {
    expect(resolveLocale('ja', undefined)).toBe('en')
  })

  it('returns DEFAULT_LOCALE when both cookie and header are undefined', () => {
    expect(resolveLocale(undefined, undefined)).toBe(DEFAULT_LOCALE)
  })

  it('cookie takes priority over Accept-Language', () => {
    expect(resolveLocale('fr', 'zh-CN')).toBe('fr')
  })

  it('parses Accept-Language and returns highest quality match', () => {
    expect(resolveLocale(undefined, 'zh-CN;q=0.9, en;q=1.0')).toBe('en')
  })

  it('returns exact match from Accept-Language', () => {
    expect(resolveLocale(undefined, 'zh-TW')).toBe('zh-TW')
  })

  it('falls back to base language match (fr-FR -> fr)', () => {
    expect(resolveLocale(undefined, 'fr-FR')).toBe('fr')
  })

  it('falls back to zh-CN for zh header', () => {
    expect(resolveLocale(undefined, 'zh')).toBe('zh-CN')
  })

  it('returns default when Accept-Language has no supported match', () => {
    expect(resolveLocale(undefined, 'ja;q=1.0, pt;q=0.8')).toBe('en')
  })

  it('handles empty cookie string', () => {
    expect(resolveLocale('', 'th')).toBe('th')
  })

  it('handles quality values correctly with multiple entries', () => {
    expect(resolveLocale(undefined, 'ko;q=0.5, th;q=0.9, fr;q=0.1')).toBe('th')
  })
})

describe('SUPPORTED_LOCALES', () => {
  it('includes en as the first locale', () => {
    expect(SUPPORTED_LOCALES[0]).toBe('en')
  })

  it('has no duplicates', () => {
    expect(new Set(SUPPORTED_LOCALES).size).toBe(SUPPORTED_LOCALES.length)
  })

  it('includes Chinese variants', () => {
    expect(SUPPORTED_LOCALES).toContain('zh-CN')
    expect(SUPPORTED_LOCALES).toContain('zh-TW')
  })
})

describe('DEFAULT_LOCALE', () => {
  it('is en', () => {
    expect(DEFAULT_LOCALE).toBe('en')
  })

  it('is in SUPPORTED_LOCALES', () => {
    expect((SUPPORTED_LOCALES as readonly string[]).includes(DEFAULT_LOCALE)).toBe(true)
  })
})
