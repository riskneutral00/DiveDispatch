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
} from '../../convex/lib/sanitize'

// ── sanitizeString ─────────────────────────────────────────────────────────────

describe('sanitizeString', () => {
  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })

  it('trims tabs and newlines', () => {
    expect(sanitizeString('\t hello \n')).toBe('hello')
  })

  it('NFC normalizes combining characters', () => {
    // é as e + combining acute accent → single é
    const decomposed = 'e\u0301'
    const composed = '\u00E9'
    expect(sanitizeString(decomposed)).toBe(composed)
  })

  it('strips null bytes', () => {
    expect(sanitizeString('he\u0000llo')).toBe('hello')
  })

  it('strips soft hyphens', () => {
    expect(sanitizeString('hel\u00ADlo')).toBe('hello')
  })

  it('strips zero-width spaces (U+200B)', () => {
    expect(sanitizeString('hel\u200Blo')).toBe('hello')
  })

  it('strips direction override characters', () => {
    expect(sanitizeString('hel\u202Alo')).toBe('hello')
    expect(sanitizeString('hel\u202Elo')).toBe('hello')
  })

  it('strips BOM (U+FEFF)', () => {
    expect(sanitizeString('\uFEFFhello')).toBe('hello')
  })

  it('preserves ZWNJ (U+200C) — required for Farsi/Persian', () => {
    expect(sanitizeString('مي\u200Cخواهم')).toContain('\u200C')
  })

  it('preserves ZWJ (U+200D) — required for compound emoji', () => {
    const familyEmoji = '👨\u200D👩\u200D👧'
    expect(sanitizeString(familyEmoji)).toContain('\u200D')
  })

  it('truncates to maxLength', () => {
    expect(sanitizeString('abcdefghij', 5)).toBe('abcde')
  })

  it('does not truncate when within maxLength', () => {
    expect(sanitizeString('hello', 10)).toBe('hello')
  })

  it('handles exact maxLength', () => {
    expect(sanitizeString('hello', 5)).toBe('hello')
  })

  it('handles maxLength of 0', () => {
    expect(sanitizeString('hello', 0)).toBe('')
  })

  it('handles empty string', () => {
    expect(sanitizeString('')).toBe('')
  })

  it('grapheme-safe truncation preserves astral characters', () => {
    // 🐬 is a surrogate pair (2 UTF-16 code units)
    const dolphins = '🐬🐬🐬🐬🐬'
    const result = sanitizeString(dolphins, 3)
    expect(Array.from(result).length).toBe(3)
    expect(result).toBe('🐬🐬🐬')
  })

  it('strips multiple invisible chars in one pass', () => {
    const dirty = '\u200B\u00AD\u0000hello\u202A\uFEFF'
    expect(sanitizeString(dirty)).toBe('hello')
  })
})

// ── sanitizeFields ─────────────────────────────────────────────────────────────

describe('sanitizeFields', () => {
  it('sanitizes string fields according to config', () => {
    const config: FieldConfig = { name: 10, email: 254 }
    const input = { name: '  John Doe  ', email: 'john@test.com', age: 30 }
    const result = sanitizeFields(input, config)
    expect(result.name).toBe('John Doe')
    expect(result.email).toBe('john@test.com')
    expect(result.age).toBe(30)
  })

  it('does not mutate the original object', () => {
    const config: FieldConfig = { name: 10 }
    const input = { name: '  John  ' }
    const result = sanitizeFields(input, config)
    expect(result).not.toBe(input)
    expect(input.name).toBe('  John  ')
  })

  it('truncates string fields to max length', () => {
    const config: FieldConfig = { name: 5 }
    const result = sanitizeFields({ name: 'Alexander' }, config)
    expect(result.name).toBe('Alexa')
  })

  it('passes through non-string fields unchanged', () => {
    const config: FieldConfig = { count: 10 }
    const result = sanitizeFields({ count: 42 }, config)
    expect(result.count).toBe(42)
  })

  it('passes through fields not in config unchanged', () => {
    const config: FieldConfig = { name: 10 }
    const result = sanitizeFields({ name: 'John', extra: '  not sanitized  ' }, config)
    expect(result.extra).toBe('  not sanitized  ')
  })

  it('skips config keys not present in object', () => {
    const config: FieldConfig = { name: 10, missing: 20 }
    const result = sanitizeFields({ name: 'John' }, config)
    expect(result).toEqual({ name: 'John' })
  })

  it('handles empty object', () => {
    const config: FieldConfig = { name: 10 }
    const result = sanitizeFields({}, config)
    expect(result).toEqual({})
  })

  it('handles empty config', () => {
    const result = sanitizeFields({ name: '  John  ' }, {})
    expect(result.name).toBe('  John  ')
  })
})

// ── sanitizePassport ───────────────────────────────────────────────────────────

describe('sanitizePassport', () => {
  it('uppercases letters', () => {
    expect(sanitizePassport('ab123')).toBe('AB123')
  })

  it('strips spaces', () => {
    expect(sanitizePassport('AB 123')).toBe('AB123')
  })

  it('strips special characters', () => {
    expect(sanitizePassport('AB.123/456')).toBe('AB123456')
  })

  it('preserves hyphens', () => {
    expect(sanitizePassport('AB-123')).toBe('AB-123')
  })

  it('truncates to 20 characters', () => {
    const long = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    expect(sanitizePassport(long).length).toBe(20)
  })

  it('strips invisible characters before processing', () => {
    expect(sanitizePassport('\u200BAB\u0000123')).toBe('AB123')
  })

  it('handles empty string', () => {
    expect(sanitizePassport('')).toBe('')
  })

  it('handles already-clean passport', () => {
    expect(sanitizePassport('N12345678')).toBe('N12345678')
  })
})

// ── sanitizeMedicalAnswers ─────────────────────────────────────────────────────

describe('sanitizeMedicalAnswers', () => {
  it('passes boolean values through unchanged', () => {
    const result = sanitizeMedicalAnswers({ q1: true, q2: false })
    expect(result.q1).toBe(true)
    expect(result.q2).toBe(false)
  })

  it('sanitizes string values', () => {
    const result = sanitizeMedicalAnswers({ notes: '  trimmed  ' })
    expect(result.notes).toBe('trimmed')
  })

  it('truncates string values to MEDICAL_ANSWER_MAX', () => {
    const longString = 'a'.repeat(MEDICAL_ANSWER_MAX + 100)
    const result = sanitizeMedicalAnswers({ notes: longString })
    expect((result.notes as string).length).toBe(MEDICAL_ANSWER_MAX)
  })

  it('does not mutate the original object', () => {
    const input = { q1: true, notes: '  hello  ' }
    const result = sanitizeMedicalAnswers(input)
    expect(result).not.toBe(input)
    expect(input.notes).toBe('  hello  ')
  })

  it('handles empty object', () => {
    expect(sanitizeMedicalAnswers({})).toEqual({})
  })

  it('handles mix of boolean and string values', () => {
    const result = sanitizeMedicalAnswers({
      hasCondition: true,
      conditionDetail: '  diabetes type 2  ',
      takingMeds: false,
      medDetail: '\u200Binsulin\u0000',
    })
    expect(result.hasCondition).toBe(true)
    expect(result.conditionDetail).toBe('diabetes type 2')
    expect(result.takingMeds).toBe(false)
    expect(result.medDetail).toBe('insulin')
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

import { PROFILE_REQUIRED } from '../../convex/lib/requiredFields'

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
