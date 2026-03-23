/**
 * Canonical language code validation for Convex mutations.
 *
 * convex/ cannot import from src/, so this mirrors the valid codes from
 * src/lib/constants/dive-languages.ts. Keep both in sync — the round-trip
 * test in tests/language-flags.test.ts will catch drift.
 */

/** All valid language codes (country-code format). */
export const VALID_LANGUAGE_CODES = new Set([
  // TOP languages
  'GB', 'FR', 'DE', 'ES', 'IT', 'NO', 'RU', 'CN', 'HK', 'TH',
  'JP', 'KR', 'ID', 'SA', 'IL',
  // OTHER languages
  'TW', 'BR', 'NL', 'SE', 'IN', 'MY', 'VN', 'PL', 'DK', 'FI',
  'IS', 'CZ', 'TR', 'GR', 'HU', 'RO', 'UA', 'PH', 'MM', 'KH',
  'BD', 'KE', 'ZA', 'HR', 'RS', 'SI', 'IR', 'PK', 'JM',
  'LT', 'LV', 'EE', 'SK', 'BG', 'AL', 'BY', 'MK', 'MT', 'IE',
  'CY', 'AD', 'FO', 'LU', 'EU',
  'ET', 'SO', 'ZW', 'RW', 'CD', 'SN', 'MG', 'ER',
  'NP', 'LK', 'LA', 'MN', 'UZ', 'KZ', 'AZ', 'GE', 'AM', 'AF',
  'IQ', 'MR', 'ML',
  'HT', 'PE', 'PY', 'NZ', 'WS', 'TO',
])

/**
 * Validate that all language codes in an array are recognized.
 * Throws ConvexError if any code is invalid.
 * Accepts labels and ISO-639 codes for backward compat (warns but doesn't reject).
 */
export function validateLanguageCodes(codes: string[]): void {
  const invalid = codes.filter((c) => !VALID_LANGUAGE_CODES.has(c))
  if (invalid.length > 0) {
    console.warn(
      `[languageCodes] Non-canonical language codes stored: ${invalid.join(', ')}. ` +
      `Expected country codes (e.g. 'GB', 'TH', 'CN'). ` +
      `Labels and ISO-639 codes still resolve via languageToCode() but are deprecated.`,
    )
  }
}
