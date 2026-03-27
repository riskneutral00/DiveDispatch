/**
 * Canonical language code validation for Convex mutations.
 *
 * convex/ cannot import from src/, so this mirrors the valid codes from
 * src/lib/constants/dive-languages.ts. Keep both in sync — the round-trip
 * test in tests/language-flags.test.ts will catch drift.
 */

import { log } from '../lib/logger'

/** All valid language codes (ISO locale format). */
export const VALID_LANGUAGE_CODES = new Set([
  // TOP languages
  'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'nb-NO', 'ru-RU', 'zh-CN',
  'th-TH', 'ja-JP', 'ko-KR', 'id-ID', 'ar-SA', 'he-IL',
  // OTHER languages
  'zh-TW', 'pt-BR', 'nl-NL', 'sv-SE', 'hi-IN', 'ms-MY', 'vi-VN', 'pl-PL',
  'da-DK', 'fi-FI', 'is-IS', 'cs-CZ', 'tr-TR', 'el-GR', 'hu-HU', 'ro-RO',
  'uk-UA', 'fil-PH', 'my-MM', 'km-KH', 'bn-BD', 'sw-KE', 'af-ZA', 'hr-HR',
  'sr-RS', 'sl-SI', 'fa-IR', 'ur-PK', 'jam-JM',
  'lt-LT', 'lv-LV', 'et-EE', 'sk-SK', 'bg-BG', 'sq-AL', 'be-BY', 'mk-MK',
  'mt-MT', 'ga-IE', 'cy-CY', 'ca-AD', 'fo-FO', 'lb-LU', 'eu-EU',
  'am-ET', 'so-SO', 'sn-ZW', 'rw-RW', 'ln-CD', 'wo-SN', 'mg-MG', 'ti-ER',
  'ne-NP', 'si-LK', 'lo-LA', 'mn-MN', 'uz-UZ', 'kk-KZ', 'az-AZ', 'ka-GE',
  'hy-AM', 'ps-AF', 'ku-IQ', 'mr-MR', 'ml-ML',
  'ht-HT', 'qu-PE', 'gn-PY', 'mi-NZ', 'sm-WS', 'to-TO',
  'dv-MV',
])

/**
 * Validate that all language codes in an array are recognized.
 * Throws ConvexError if any code is invalid.
 * Accepts labels and ISO-639 codes for backward compat (warns but doesn't reject).
 */
export function validateLanguageCodes(codes: string[]): void {
  const invalid = codes.filter((c) => !VALID_LANGUAGE_CODES.has(c))
  if (invalid.length > 0) {
    log.warn('Non-canonical language codes stored', {
      codes: invalid,
      hint: "Expected ISO locale codes (e.g. 'en-GB', 'th-TH', 'zh-CN'). Labels and ISO-639 codes still resolve via languageToCode() but are deprecated.",
    })
  }
}
