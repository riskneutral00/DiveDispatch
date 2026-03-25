import { describe, it, expect, vi } from 'vitest'
import { VALID_LANGUAGE_CODES, validateLanguageCodes } from '../convex/shared/languageCodes'

describe('VALID_LANGUAGE_CODES', () => {
  it('contains expected top codes', () => {
    expect(VALID_LANGUAGE_CODES.has('GB')).toBe(true)
    expect(VALID_LANGUAGE_CODES.has('TH')).toBe(true)
    expect(VALID_LANGUAGE_CODES.has('JP')).toBe(true)
    expect(VALID_LANGUAGE_CODES.has('CN')).toBe(true)
  })

  it('does not contain invalid codes', () => {
    expect(VALID_LANGUAGE_CODES.has('XX')).toBe(false)
    expect(VALID_LANGUAGE_CODES.has('')).toBe(false)
  })
})

describe('validateLanguageCodes', () => {
  it('does not warn for valid codes', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    validateLanguageCodes(['GB', 'TH', 'JP'])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('warns for non-canonical codes but does not throw', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    validateLanguageCodes(['GB', 'INVALID_CODE'])
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
