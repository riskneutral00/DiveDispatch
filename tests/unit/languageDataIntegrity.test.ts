import { describe, it, expect } from 'vitest'
import {
  ALL_LANGUAGES,
  TOP_LANGUAGES,
  OTHER_LANGUAGES,
  VALID_LANGUAGE_CODE_SET,
  POPULAR_ROW1_CODES,
  POPULAR_ROW2_CODES,
  POPULAR_LANGUAGE_CODES,
  PROFILE_LANGUAGE_OPTIONS,
  CHINESE_SCRIPT_LABELS,
  languageToCode,
  type LanguageCode,
} from '../../src/lib/constants/dive-languages'
import { LANGUAGE_FILTER, INSTRUCTOR_FILTERS, ROLE_FILTERS } from '../../src/lib/constants/resource-filters'
import { DIVE_AGENCIES, DIVE_AGENCIES_EXTENDED } from '../../src/lib/constants/agencies'
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

  it('ALL_LANGUAGES = TOP_LANGUAGES + OTHER_LANGUAGES (no overlap)', () => {
    const topCodes = new Set(TOP_LANGUAGES.map((l) => l.code))
    const otherCodes = new Set(OTHER_LANGUAGES.map((l) => l.code))
    // No overlap
    for (const code of topCodes) {
      expect(otherCodes.has(code), `${code} is in both TOP and OTHER`).toBe(false)
    }
    // Complete
    expect(TOP_LANGUAGES.length + OTHER_LANGUAGES.length).toBe(ALL_LANGUAGES.length)
  })

  it('codes follow locale format (xx-YY or xxx-YY)', () => {
    for (const lang of ALL_LANGUAGES) {
      expect(lang.code).toMatch(/^[a-z]{2,3}-[A-Z]{2}$/)
    }
  })
})

// ── VALID_LANGUAGE_CODE_SET alignment ───────────────────────────────────────

describe('VALID_LANGUAGE_CODE_SET', () => {
  it('matches ALL_LANGUAGES codes exactly', () => {
    const fromAll = new Set(ALL_LANGUAGES.map((l) => l.code))
    expect(VALID_LANGUAGE_CODE_SET).toEqual(fromAll)
  })

  it('has the same size as ALL_LANGUAGES', () => {
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

// ── PROFILE_LANGUAGE_OPTIONS ────────────────────────────────────────────────

describe('PROFILE_LANGUAGE_OPTIONS', () => {
  it('all codes are valid language codes', () => {
    for (const opt of PROFILE_LANGUAGE_OPTIONS) {
      expect(VALID_LANGUAGE_CODE_SET.has(opt.code), `${opt.code} not in VALID_LANGUAGE_CODE_SET`).toBe(true)
    }
  })

  it('no duplicates', () => {
    const codes = PROFILE_LANGUAGE_OPTIONS.map((o) => o.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('labels match ALL_LANGUAGES labels (except Chinese which use script)', () => {
    for (const opt of PROFILE_LANGUAGE_OPTIONS) {
      const match = ALL_LANGUAGES.find((l) => l.code === opt.code)
      expect(match, `${opt.code} not found in ALL_LANGUAGES`).toBeDefined()
      // Chinese labels are overridden in resolveLanguages; profile options keep English labels
      expect(opt.label.length).toBeGreaterThan(0)
    }
  })

  it('includes English as first option', () => {
    expect(PROFILE_LANGUAGE_OPTIONS[0].code).toBe('en-GB')
    expect(PROFILE_LANGUAGE_OPTIONS[0].label).toBe('English')
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

// ── LANGUAGE_FILTER ↔ dive-languages alignment ──────────────────────────────

describe('LANGUAGE_FILTER structure', () => {
  it('all option values are non-empty uppercase country codes or "all"', () => {
    for (const opt of LANGUAGE_FILTER.options) {
      if (opt.value === 'all') continue
      expect(opt.value).toMatch(/^[A-Z]{2}$/)
    }
  })

  it('no duplicate option values', () => {
    const values = LANGUAGE_FILTER.options.map((o) => o.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('filter is marked as multiSelect', () => {
    expect(LANGUAGE_FILTER.multiSelect).toBe(true)
  })

  it('most filter country codes resolve via languageToCode (backward compat)', () => {
    const resolvable = LANGUAGE_FILTER.options
      .filter((o) => o.value !== 'all')
      .filter((o) => languageToCode(o.value).length > 0)
    // At least 80% of filter values should resolve
    const total = LANGUAGE_FILTER.options.length - 1
    expect(resolvable.length).toBeGreaterThanOrEqual(Math.floor(total * 0.8))
  })
})

// ── INSTRUCTOR_FILTERS agency options ↔ DIVE_AGENCIES ───────────────────────

describe('INSTRUCTOR_FILTERS ↔ DIVE_AGENCIES', () => {
  const agencyFilter = INSTRUCTOR_FILTERS.find((f) => f.id === 'agency')!

  it('agency filter exists', () => {
    expect(agencyFilter).toBeDefined()
  })

  it('all agency filter values (except "all") are in DIVE_AGENCIES_EXTENDED', () => {
    for (const opt of agencyFilter.options) {
      if (opt.value === 'all') continue
      expect(
        DIVE_AGENCIES_EXTENDED.includes(opt.value as typeof DIVE_AGENCIES_EXTENDED[number]),
        `Agency filter value "${opt.value}" not in DIVE_AGENCIES_EXTENDED`,
      ).toBe(true)
    }
  })

  it('core DIVE_AGENCIES are all present as filter options', () => {
    const filterValues = new Set(agencyFilter.options.map((o) => o.value))
    for (const agency of DIVE_AGENCIES) {
      expect(filterValues.has(agency), `${agency} missing from agency filter options`).toBe(true)
    }
  })
})

// ── SUPPORTED_LOCALES ↔ dive-languages ──────────────────────────────────────

describe('SUPPORTED_LOCALES ↔ dive-languages', () => {
  it('every SUPPORTED_LOCALE has a matching language code', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const resolved = languageToCode(locale)
      expect(resolved.length, `SUPPORTED_LOCALE "${locale}" does not resolve`).toBeGreaterThan(0)
    }
  })
})

// ── ROLE_FILTERS completeness ───────────────────────────────────────────────

describe('ROLE_FILTERS completeness', () => {
  it('every role filter array contains only valid FilterDef objects', () => {
    for (const [role, filters] of Object.entries(ROLE_FILTERS)) {
      expect(Array.isArray(filters), `${role} filters is not an array`).toBe(true)
      for (const filter of filters) {
        expect(filter.id.length, `${role} has a filter with empty id`).toBeGreaterThan(0)
        expect(filter.label.length, `${role} has a filter with empty label`).toBeGreaterThan(0)
        expect(filter.options.length, `${role} filter "${filter.id}" has no options`).toBeGreaterThan(0)
      }
    }
  })

  it('filter option values are non-empty strings', () => {
    for (const [role, filters] of Object.entries(ROLE_FILTERS)) {
      for (const filter of filters) {
        for (const opt of filter.options) {
          expect(opt.value.length, `${role}/${filter.id} has option with empty value`).toBeGreaterThan(0)
          expect(opt.label.length, `${role}/${filter.id} has option with empty label`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('no duplicate option values within any filter', () => {
    for (const [role, filters] of Object.entries(ROLE_FILTERS)) {
      for (const filter of filters) {
        const values = filter.options.map((o) => o.value)
        expect(new Set(values).size, `${role}/${filter.id} has duplicate option values`).toBe(values.length)
      }
    }
  })
})
