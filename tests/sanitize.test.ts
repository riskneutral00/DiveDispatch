import { describe, it, expect } from 'vitest'
import {
  sanitizeString,
  sanitizeFields,
  sanitizePassport,
  sanitizeMedicalAnswers,
  NAME_MAX,
  EMAIL_MAX,
  SHORT_TEXT_MAX,
} from '../convex/lib/sanitize'

describe('sanitizeString', () => {
  it('trims leading and trailing whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })

  it('NFC normalizes combining characters', () => {
    // é as e + combining acute vs precomposed é
    const decomposed = 'e\u0301'
    const composed = '\u00e9'
    expect(sanitizeString(decomposed)).toBe(composed)
  })

  it('strips null bytes', () => {
    expect(sanitizeString('ab\u0000cd')).toBe('abcd')
  })

  it('strips soft hyphens', () => {
    expect(sanitizeString('soft\u00ADhyphen')).toBe('softhyphen')
  })

  it('strips zero-width spaces', () => {
    expect(sanitizeString('zero\u200Bwidth')).toBe('zerowidth')
  })

  it('strips BOM / FEFF', () => {
    expect(sanitizeString('\uFEFFhello')).toBe('hello')
  })

  it('strips direction override characters', () => {
    expect(sanitizeString('a\u202Eb')).toBe('ab')
  })

  it('preserves ZWNJ (required for Farsi/Persian)', () => {
    expect(sanitizeString('a\u200Cb')).toBe('a\u200Cb')
  })

  it('preserves ZWJ (required for compound emoji)', () => {
    expect(sanitizeString('a\u200Db')).toBe('a\u200Db')
  })

  it('truncates to maxLength', () => {
    expect(sanitizeString('abcdefgh', 5)).toBe('abcde')
  })

  it('does not truncate when within maxLength', () => {
    expect(sanitizeString('abc', 5)).toBe('abc')
  })

  it('handles astral characters correctly during truncation', () => {
    // 𝕳 is a single codepoint but two UTF-16 code units
    const astral = '𝕳𝕳𝕳'
    expect(sanitizeString(astral, 2)).toBe('𝕳𝕳')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeString('   \t\n  ')).toBe('')
  })

  it('handles empty string', () => {
    expect(sanitizeString('')).toBe('')
  })
})

describe('sanitizeFields', () => {
  it('sanitizes string fields according to config', () => {
    const result = sanitizeFields(
      { name: '  Alice  ', age: 30 },
      { name: NAME_MAX },
    )
    expect(result.name).toBe('Alice')
    expect(result.age).toBe(30)
  })

  it('truncates string fields to configured max length', () => {
    const result = sanitizeFields(
      { email: 'a'.repeat(300) },
      { email: EMAIL_MAX },
    )
    expect((result.email as string).length).toBe(EMAIL_MAX)
  })

  it('does not mutate the original object', () => {
    const original = { name: '  Bob  ' }
    sanitizeFields(original, { name: NAME_MAX })
    expect(original.name).toBe('  Bob  ')
  })

  it('passes through fields not in config unchanged', () => {
    const result = sanitizeFields(
      { name: '  Alice  ', extra: '  untouched  ' },
      { name: NAME_MAX },
    )
    expect(result.extra).toBe('  untouched  ')
  })

  it('skips config fields not present in the object', () => {
    const result = sanitizeFields(
      { name: 'Alice' },
      { name: NAME_MAX, missing: SHORT_TEXT_MAX },
    )
    expect(result).toEqual({ name: 'Alice' })
  })

  it('skips non-string fields even if in config', () => {
    const result = sanitizeFields(
      { count: 42 },
      { count: 10 },
    )
    expect(result.count).toBe(42)
  })
})

describe('sanitizePassport', () => {
  it('uppercases and strips non-alphanumeric except hyphen', () => {
    expect(sanitizePassport('ab-123.xyz')).toBe('AB-123XYZ')
  })

  it('strips spaces', () => {
    expect(sanitizePassport('AB 1234')).toBe('AB1234')
  })

  it('truncates to 20 characters', () => {
    expect(sanitizePassport('A'.repeat(25))).toBe('A'.repeat(20))
  })

  it('handles empty string', () => {
    expect(sanitizePassport('')).toBe('')
  })

  it('strips invisible characters before processing', () => {
    expect(sanitizePassport('\u200BAB123')).toBe('AB123')
  })
})

describe('sanitizeMedicalAnswers', () => {
  it('passes boolean values through unchanged', () => {
    const result = sanitizeMedicalAnswers({ asthma: true, epilepsy: false })
    expect(result.asthma).toBe(true)
    expect(result.epilepsy).toBe(false)
  })

  it('sanitizes string values', () => {
    const result = sanitizeMedicalAnswers({ details: '  some notes  ' })
    expect(result.details).toBe('some notes')
  })

  it('does not mutate the original object', () => {
    const original = { notes: '  text  ' }
    sanitizeMedicalAnswers(original)
    expect(original.notes).toBe('  text  ')
  })

  it('handles mixed boolean and string values', () => {
    const result = sanitizeMedicalAnswers({
      q1: true,
      q1Detail: '  note  ',
      q2: false,
    })
    expect(result).toEqual({ q1: true, q1Detail: 'note', q2: false })
  })
})
