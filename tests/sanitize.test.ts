import { describe, it, expect } from 'vitest'
import {
  sanitizeString,
  sanitizeFields,
  sanitizePassport,
  sanitizeMedicalAnswers,
  NAME_MAX,
  EMAIL_MAX,
  PHONE_MAX,
  SHORT_TEXT_MAX,
  LONG_TEXT_MAX,
  SUPPORT_MESSAGE_MAX,
  MEDICAL_ANSWER_MAX,
  DRAFT_STATE_MAX,
  USER_FIELDS,
  PROFILE_FIELDS,
  CUSTOMER_FIELDS,
  SUPPORT_FIELDS,
  PORTAL_SAFETY_FIELDS,
  PORTAL_WAIVER_FIELDS,
  PORTAL_EQUIPMENT_FIELDS,
  PORTAL_EQUIPMENT_CHECKLIST_FIELDS,
  BOOKING_TEMPLATE_FIELDS,
  THEME_FIELDS,
  PORTAL_CONTACT_FIELDS,
  type FieldConfig,
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

  it('handles exact maxLength', () => {
    expect(sanitizeString('hello', 5)).toBe('hello')
  })

  it('handles maxLength of 0', () => {
    expect(sanitizeString('hello', 0)).toBe('')
  })

  it('grapheme-safe truncation preserves astral characters', () => {
    const dolphins = '\u{1F42C}\u{1F42C}\u{1F42C}\u{1F42C}\u{1F42C}'
    const result = sanitizeString(dolphins, 3)
    expect(Array.from(result).length).toBe(3)
  })

  it('strips multiple invisible chars in one pass', () => {
    const dirty = '\u200B\u00AD\u0000hello\u202A\uFEFF'
    expect(sanitizeString(dirty)).toBe('hello')
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

  it('handles empty object', () => {
    const result = sanitizeFields({}, { name: 10 })
    expect(result).toEqual({})
  })

  it('handles empty config', () => {
    const result = sanitizeFields({ name: '  John  ' }, {})
    expect(result.name).toBe('  John  ')
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

  it('preserves hyphens', () => {
    expect(sanitizePassport('AB-123')).toBe('AB-123')
  })

  it('handles already-clean passport', () => {
    expect(sanitizePassport('N12345678')).toBe('N12345678')
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

  it('truncates string values to MEDICAL_ANSWER_MAX', () => {
    const longString = 'a'.repeat(MEDICAL_ANSWER_MAX + 100)
    const result = sanitizeMedicalAnswers({ notes: longString })
    expect((result.notes as string).length).toBe(MEDICAL_ANSWER_MAX)
  })

  it('handles empty object', () => {
    expect(sanitizeMedicalAnswers({})).toEqual({})
  })
})

// ── Length constant relationships ──────────────────────────────────────────────

describe('sanitize length constants', () => {
  it('NAME_MAX is reasonable (100-500)', () => {
    expect(NAME_MAX).toBeGreaterThanOrEqual(100)
    expect(NAME_MAX).toBeLessThanOrEqual(500)
  })

  it('EMAIL_MAX is 254 (RFC 5321)', () => {
    expect(EMAIL_MAX).toBe(254)
  })

  it('PHONE_MAX is 30', () => {
    expect(PHONE_MAX).toBe(30)
  })

  it('SHORT_TEXT_MAX < NAME_MAX or equal', () => {
    expect(SHORT_TEXT_MAX).toBeLessThanOrEqual(NAME_MAX)
  })

  it('LONG_TEXT_MAX > NAME_MAX', () => {
    expect(LONG_TEXT_MAX).toBeGreaterThan(NAME_MAX)
  })

  it('SUPPORT_MESSAGE_MAX > LONG_TEXT_MAX', () => {
    expect(SUPPORT_MESSAGE_MAX).toBeGreaterThan(LONG_TEXT_MAX)
  })

  it('MEDICAL_ANSWER_MAX equals LONG_TEXT_MAX', () => {
    expect(MEDICAL_ANSWER_MAX).toBe(LONG_TEXT_MAX)
  })

  it('DRAFT_STATE_MAX is generous (>= 10000)', () => {
    expect(DRAFT_STATE_MAX).toBeGreaterThanOrEqual(10000)
  })
})

// ── Field config structural integrity ──────────────────────────────────────────

describe('field configs structural integrity', () => {
  const configs: [string, FieldConfig][] = [
    ['USER_FIELDS', USER_FIELDS],
    ['PROFILE_FIELDS', PROFILE_FIELDS],
    ['CUSTOMER_FIELDS', CUSTOMER_FIELDS],
    ['SUPPORT_FIELDS', SUPPORT_FIELDS],
    ['PORTAL_SAFETY_FIELDS', PORTAL_SAFETY_FIELDS],
    ['PORTAL_WAIVER_FIELDS', PORTAL_WAIVER_FIELDS],
    ['PORTAL_EQUIPMENT_FIELDS', PORTAL_EQUIPMENT_FIELDS],
    ['PORTAL_EQUIPMENT_CHECKLIST_FIELDS', PORTAL_EQUIPMENT_CHECKLIST_FIELDS],
    ['BOOKING_TEMPLATE_FIELDS', BOOKING_TEMPLATE_FIELDS],
    ['THEME_FIELDS', THEME_FIELDS],
    ['PORTAL_CONTACT_FIELDS', PORTAL_CONTACT_FIELDS],
  ]

  for (const [name, config] of configs) {
    describe(name, () => {
      it('has at least one field', () => {
        expect(Object.keys(config).length).toBeGreaterThan(0)
      })

      it('all max lengths are positive integers', () => {
        for (const [field, maxLen] of Object.entries(config)) {
          expect(Number.isInteger(maxLen), `${field} maxLen is not integer`).toBe(true)
          expect(maxLen, `${field} maxLen is not positive`).toBeGreaterThan(0)
        }
      })

      it('all max lengths use standard presets', () => {
        const presets = new Set([NAME_MAX, EMAIL_MAX, PHONE_MAX, SHORT_TEXT_MAX, LONG_TEXT_MAX, SUPPORT_MESSAGE_MAX])
        for (const [field, maxLen] of Object.entries(config)) {
          expect(presets.has(maxLen), `${name}.${field} uses non-standard max length ${maxLen}`).toBe(true)
        }
      })
    })
  }

  it('CUSTOMER_FIELDS and PORTAL_CONTACT_FIELDS share the same contact fields', () => {
    const contactFields = ['legalFirstName', 'legalLastName', 'email', 'phone']
    for (const field of contactFields) {
      expect(CUSTOMER_FIELDS[field], `CUSTOMER_FIELDS.${field}`).toBeDefined()
      expect(PORTAL_CONTACT_FIELDS[field], `PORTAL_CONTACT_FIELDS.${field}`).toBeDefined()
      expect(CUSTOMER_FIELDS[field]).toBe(PORTAL_CONTACT_FIELDS[field])
    }
  })

  it('email fields always use EMAIL_MAX', () => {
    for (const [name, config] of configs) {
      if ('email' in config) {
        expect(config.email, `${name}.email`).toBe(EMAIL_MAX)
      }
    }
  })

  it('phone fields always use PHONE_MAX', () => {
    for (const [name, config] of configs) {
      if ('phone' in config) {
        expect(config.phone, `${name}.phone`).toBe(PHONE_MAX)
      }
    }
  })
})

// ── requiredFields alignment with sanitize field configs ───────────────────────

import { PROFILE_REQUIRED } from '../convex/lib/requiredFields'

describe('requiredFields ↔ sanitize field configs', () => {
  it('every PROFILE_REQUIRED field has a matching sanitize config', () => {
    const allFields = new Set([
      ...Object.keys(USER_FIELDS),
      ...Object.keys(PROFILE_FIELDS),
    ])
    for (const field of PROFILE_REQUIRED) {
      expect(allFields.has(field), `PROFILE_REQUIRED "${field}" not in USER_FIELDS or PROFILE_FIELDS`).toBe(true)
    }
  })
})
