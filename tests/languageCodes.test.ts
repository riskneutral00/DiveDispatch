import { describe, it, expect, vi } from 'vitest'
import { VALID_LANGUAGE_CODES, validateLanguageCodes } from '../convex/shared/languageCodes'

describe('VALID_LANGUAGE_CODES', () => {
  it('contains expected top codes in ISO locale format', () => {
    expect(VALID_LANGUAGE_CODES.has('en-GB')).toBe(true)
    expect(VALID_LANGUAGE_CODES.has('th-TH')).toBe(true)
    expect(VALID_LANGUAGE_CODES.has('ja-JP')).toBe(true)
    expect(VALID_LANGUAGE_CODES.has('zh-CN')).toBe(true)
  })

  it('does not contain old country-code format', () => {
    expect(VALID_LANGUAGE_CODES.has('GB')).toBe(false)
    expect(VALID_LANGUAGE_CODES.has('TH')).toBe(false)
    expect(VALID_LANGUAGE_CODES.has('JP')).toBe(false)
    expect(VALID_LANGUAGE_CODES.has('CN')).toBe(false)
  })

  it('does not contain invalid codes', () => {
    expect(VALID_LANGUAGE_CODES.has('XX')).toBe(false)
    expect(VALID_LANGUAGE_CODES.has('')).toBe(false)
  })
})

describe('validateLanguageCodes', () => {
  it('does not warn for valid ISO locale codes', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    validateLanguageCodes(['en-GB', 'th-TH', 'ja-JP'])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('warns for non-canonical codes but does not throw', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    validateLanguageCodes(['en-GB', 'INVALID_CODE'])
    expect(spy).toHaveBeenCalledOnce()
    const output = spy.mock.calls[0][0] as string
    const parsed = JSON.parse(output)
    expect(parsed.level).toBe('warn')
    expect(parsed.codes).toContain('INVALID_CODE')
    spy.mockRestore()
  })

  it('handles empty array without warning', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    validateLanguageCodes([])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
