import { describe, it, expect } from 'vitest'
import {
  ALL_LANGUAGES,
  POPULAR_ROW1_CODES,
  POPULAR_ROW2_CODES,
  POPULAR_LANGUAGE_CODES,
  CHINESE_SCRIPT_LABELS,
  languageToCode,
  type LanguageCode,
} from '../../src/lib/constants/dive-languages'

// Reconstruct validation set from ALL_LANGUAGES (the internal VALID_LANGUAGE_CODE_SET is no longer exported)
const VALID_LANGUAGE_CODE_SET = new Set(ALL_LANGUAGES.map((l: { code: string }) => l.code))
import { SUPPORTED_LOCALES } from '../../src/lib/constants/locales'

// ── ALL_LANGUAGES structural invariants ─────────────────────────────────────

describe('ALL_LANGUAGES structural integrity', () => {
  it('no duplicate codes', () => {
    const codes = ALL_LANGUAGES.map((l) => l.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('every entry has non-empty code and label', () => {
    for (const lang of ALL_LANGUAGES) {
      expect(lang.code.length, `empty code found`).toBeGreaterThan(0)
      expect(lang.label.length, `${lang.code} has empty label`).toBeGreaterThan(0)
    }
  })

  it('codes follow locale format (xx-YY or xxx-YY)', () => {
    for (const lang of ALL_LANGUAGES) {
      expect(lang.code).toMatch(/^[a-z]{2,3}-[A-Z]{2}$/)
    }
  })
})

// ── Language code set alignment ────────────────────────────────────────────

describe('VALID_LANGUAGE_CODE_SET (derived)', () => {
  it('has the same size as ALL_LANGUAGES (no duplicate codes)', () => {
    expect(VALID_LANGUAGE_CODE_SET.size).toBe(ALL_LANGUAGES.length)
  })
})

// ── POPULAR_LANGUAGE_CODES ──────────────────────────────────────────────────

describe('POPULAR_LANGUAGE_CODES', () => {
  it('all codes are valid language codes', () => {
    for (const code of POPULAR_LANGUAGE_CODES) {
      expect(VALID_LANGUAGE_CODE_SET.has(code), `${code} not in VALID_LANGUAGE_CODE_SET`).toBe(true)
    }
  })

  it('no duplicates between ROW1 and ROW2', () => {
    const row1Set = new Set(POPULAR_ROW1_CODES)
    for (const code of POPULAR_ROW2_CODES) {
      expect(row1Set.has(code), `${code} appears in both ROW1 and ROW2`).toBe(false)
    }
  })

  it('POPULAR_LANGUAGE_CODES = ROW1 + ROW2', () => {
    expect(POPULAR_LANGUAGE_CODES).toEqual([...POPULAR_ROW1_CODES, ...POPULAR_ROW2_CODES])
  })

  it('no duplicates within POPULAR_LANGUAGE_CODES', () => {
    expect(new Set(POPULAR_LANGUAGE_CODES).size).toBe(POPULAR_LANGUAGE_CODES.length)
  })

  it('ROW1 has Asian languages, ROW2 has European plus zh-TW', () => {
    expect(POPULAR_ROW1_CODES).toContain('zh-CN')
    expect(POPULAR_ROW1_CODES).toContain('th-TH')
    expect(POPULAR_ROW1_CODES).toContain('ja-JP')
    expect(POPULAR_ROW2_CODES).toContain('zh-TW')
    expect(POPULAR_ROW2_CODES).toContain('en-GB')
    expect(POPULAR_ROW2_CODES).toContain('fr-FR')
  })
})


// ── CHINESE_SCRIPT_LABELS ───────────────────────────────────────────────────

describe('CHINESE_SCRIPT_LABELS', () => {
  it('only contains Chinese variant codes', () => {
    for (const code of Object.keys(CHINESE_SCRIPT_LABELS)) {
      expect(code.startsWith('zh-'), `${code} is not a Chinese variant`).toBe(true)
    }
  })

  it('values are non-empty native script strings', () => {
    for (const [code, label] of Object.entries(CHINESE_SCRIPT_LABELS)) {
      expect(label!.length, `${code} has empty script label`).toBeGreaterThan(0)
    }
  })

  it('covers zh-CN and zh-TW', () => {
    expect(CHINESE_SCRIPT_LABELS['zh-CN']).toBe('简体')
    expect(CHINESE_SCRIPT_LABELS['zh-TW']).toBe('繁體')
  })
})

describe('SUPPORTED_LOCALES ↔ dive-languages', () => {
  it('every SUPPORTED_LOCALE has a matching language code', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const resolved = languageToCode(locale)
      expect(resolved.length, `SUPPORTED_LOCALE "${locale}" does not resolve`).toBeGreaterThan(0)
    }
  })
})

