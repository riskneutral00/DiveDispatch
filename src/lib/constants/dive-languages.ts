const TOP_LANGUAGE_ENTRIES = [
  { code: 'en-GB', label: 'English' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'nb-NO', label: 'Norwegian' },
  { code: 'ru-RU', label: 'Russian' },
  { code: 'zh-CN', label: 'Mandarin' },
  { code: 'th-TH', label: 'Thai' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'id-ID', label: 'Indonesian' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'he-IL', label: 'Hebrew' },
] as const

const OTHER_LANGUAGE_ENTRIES = [
  { code: 'zh-TW', label: 'Chinese (Traditional)' },
  { code: 'pt-BR', label: 'Portuguese' },
  { code: 'nl-NL', label: 'Dutch' },
  { code: 'sv-SE', label: 'Swedish' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'ms-MY', label: 'Malay' },
  { code: 'vi-VN', label: 'Vietnamese' },
  { code: 'dv-MV', label: 'Dhivehi' },
  { code: 'pl-PL', label: 'Polish' },
  { code: 'da-DK', label: 'Danish' },
  { code: 'fi-FI', label: 'Finnish' },
  { code: 'is-IS', label: 'Icelandic' },
  { code: 'cs-CZ', label: 'Czech' },
  { code: 'tr-TR', label: 'Turkish' },
  { code: 'el-GR', label: 'Greek' },
  { code: 'hu-HU', label: 'Hungarian' },
  { code: 'ro-RO', label: 'Romanian' },
  { code: 'uk-UA', label: 'Ukrainian' },
  { code: 'fil-PH', label: 'Filipino' },
  { code: 'my-MM', label: 'Burmese' },
  { code: 'km-KH', label: 'Khmer' },
  { code: 'bn-BD', label: 'Bengali' },
  { code: 'sw-KE', label: 'Swahili' },
  { code: 'af-ZA', label: 'Afrikaans' },
  { code: 'hr-HR', label: 'Croatian' },
  { code: 'sr-RS', label: 'Serbian' },
  { code: 'sl-SI', label: 'Slovenian' },
  { code: 'fa-IR', label: 'Farsi' },
  { code: 'ur-PK', label: 'Urdu' },
  { code: 'jam-JM', label: 'Jamaican Patois' },

  // European
  { code: 'lt-LT', label: 'Lithuanian' },
  { code: 'lv-LV', label: 'Latvian' },
  { code: 'et-EE', label: 'Estonian' },
  { code: 'sk-SK', label: 'Slovak' },
  { code: 'bg-BG', label: 'Bulgarian' },
  { code: 'sq-AL', label: 'Albanian' },
  { code: 'be-BY', label: 'Belarusian' },
  { code: 'mk-MK', label: 'Macedonian' },
  { code: 'mt-MT', label: 'Maltese' },
  { code: 'ga-IE', label: 'Irish' },
  { code: 'cy-CY', label: 'Welsh' },
  { code: 'ca-AD', label: 'Catalan' },
  { code: 'fo-FO', label: 'Faroese' },
  { code: 'lb-LU', label: 'Luxembourgish' },
  { code: 'eu-EU', label: 'Basque' },

  // African
  { code: 'am-ET', label: 'Amharic' },
  { code: 'so-SO', label: 'Somali' },
  { code: 'sn-ZW', label: 'Shona' },
  { code: 'rw-RW', label: 'Kinyarwanda' },
  { code: 'ln-CD', label: 'Lingala' },
  { code: 'wo-SN', label: 'Wolof' },
  { code: 'mg-MG', label: 'Malagasy' },
  { code: 'ti-ER', label: 'Tigrinya' },

  // Asian / Central Asian
  { code: 'ne-NP', label: 'Nepali' },
  { code: 'si-LK', label: 'Sinhala' },
  { code: 'lo-LA', label: 'Lao' },
  { code: 'mn-MN', label: 'Mongolian' },
  { code: 'uz-UZ', label: 'Uzbek' },
  { code: 'kk-KZ', label: 'Kazakh' },
  { code: 'az-AZ', label: 'Azerbaijani' },
  { code: 'ka-GE', label: 'Georgian' },
  { code: 'hy-AM', label: 'Armenian' },
  { code: 'ps-AF', label: 'Pashto' },
  { code: 'ku-IQ', label: 'Kurdish' },
  { code: 'mr-MR', label: 'Marathi' },
  { code: 'ml-ML', label: 'Malayalam' },

  // Americas / Pacific
  { code: 'ht-HT', label: 'Haitian Creole' },
  { code: 'qu-PE', label: 'Quechua' },
  { code: 'gn-PY', label: 'Guaraní' },
  { code: 'mi-NZ', label: 'Māori' },
  { code: 'sm-WS', label: 'Samoan' },
  { code: 'to-TO', label: 'Tongan' },
] as const

export type LanguageCode =
  | (typeof TOP_LANGUAGE_ENTRIES)[number]['code']
  | (typeof OTHER_LANGUAGE_ENTRIES)[number]['code']

export interface DiveLanguage {
  code: LanguageCode
  label: string
  searchTerms?: string
}

const SEARCH_TERMS: Partial<Record<LanguageCode, string>> = {
  'zh-CN': 'chinese mandarin simplified',
  'zh-TW': 'chinese traditional taiwan',

  'dv-MV': 'maldives maldivian divehi',
  'jam-JM': 'jamaican',
  'fil-PH': 'tagalog filipino philippines',
  'cy-CY': 'cymraeg uk britain',
  'am-ET': 'ethiopian',
  'ti-ER': 'eritrean ethiopian',
  'mi-NZ': 'new zealand',
  'gn-PY': 'guarani paraguay',
  'ml-ML': 'kerala india',
}

const withSearchTerms = (
  entries: readonly { code: LanguageCode; label: string }[],
): DiveLanguage[] =>
  entries.map((e) => ({
    ...e,
    ...(SEARCH_TERMS[e.code] ? { searchTerms: SEARCH_TERMS[e.code] } : {}),
  }))

export const TOP_LANGUAGES: DiveLanguage[] = withSearchTerms(TOP_LANGUAGE_ENTRIES)
export const OTHER_LANGUAGES: DiveLanguage[] = withSearchTerms(OTHER_LANGUAGE_ENTRIES)
export const ALL_LANGUAGES: DiveLanguage[] = [...TOP_LANGUAGES, ...OTHER_LANGUAGES]

export const VALID_LANGUAGE_CODE_SET = new Set<string>(ALL_LANGUAGES.map((l) => l.code))

// Build reverse lookup: language label → ISO locale code (case-insensitive)
const _labelToCode = new Map<string, string>(
  ALL_LANGUAGES.map((l) => [l.label.toLowerCase(), l.code]),
)

// ISO-639 language codes → ISO locale codes for backward compatibility
// Profile forms historically stored ISO-639 ('en', 'th', 'zh'), but the
// canonical format is now ISO locales ('en-GB', 'th-TH', 'zh-CN').
const ISO_TO_LOCALE: Record<string, string> = {
  en: 'en-GB', th: 'th-TH', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR',
  fr: 'fr-FR', de: 'de-DE', ru: 'ru-RU', it: 'it-IT', es: 'es-ES', pt: 'pt-BR',
  nl: 'nl-NL', ar: 'ar-SA', he: 'he-IL', sv: 'sv-SE', pl: 'pl-PL',
}

// Old country codes → ISO locale codes for backward compatibility
// DB records may still contain bare country codes ('GB', 'TH', 'CN').
const COUNTRY_TO_LOCALE: Record<string, string> = Object.fromEntries(
  ALL_LANGUAGES.map((l) => [localeToCountryCode(l.code), l.code]),
)

/** Extract the country/region code from an ISO locale code.
 *  'en-GB' → 'GB', 'zh-CN' → 'CN', 'GB' → 'GB' (passthrough). */
export function localeToCountryCode(locale: string): string {
  if (locale.includes('-')) {
    const parts = locale.split('-')
    return parts[parts.length - 1].toUpperCase()
  }
  return locale.toUpperCase()
}

/** Convert a language name/label/code to its ISO locale code.
 *  Handles all formats: "English" → "en-GB", "en-GB" → "en-GB",
 *  "GB" → "en-GB" (backward compat), "en" → "en-GB". */
export function languageToCode(input: string): string {
  if (!input) return ''

  // Direct match: already an ISO locale code
  if (VALID_LANGUAGE_CODE_SET.has(input)) return input

  // Case-insensitive direct match
  const candidates = ALL_LANGUAGES.filter((l) => l.code.toLowerCase() === input.toLowerCase())
  if (candidates.length > 0) return candidates[0].code

  const lower = input.toLowerCase()

  // ISO-639 bare language code: 'en' → 'en-GB'
  const isoHit = ISO_TO_LOCALE[lower]
  if (isoHit) return isoHit

  // Old country code format: 'GB' → 'en-GB'
  const upper = input.toUpperCase()
  const countryHit = COUNTRY_TO_LOCALE[upper]
  if (countryHit) return countryHit

  // Handle locale codes like 'zh-CN', 'en-US', 'fr-CA'
  if (lower.includes('-')) {
    const region = lower.split('-').pop()!.toUpperCase()
    const regionHit = COUNTRY_TO_LOCALE[region]
    if (regionHit) return regionHit
    const lang = lower.split('-')[0]
    const localeHit = ISO_TO_LOCALE[lang]
    if (localeHit) return localeHit
  }

  // Label lookup: "English" → "en-GB"
  return _labelToCode.get(lower) ?? ''
}

/** Resolve an array of raw DB language codes to Language objects.
 *  Handles ISO locales ('zh-CN'), country codes ('CN'), ISO-639 ('zh'), and locales ('en-US'). */
export function resolveLanguages(codes: string[]): { code: string; label: string }[] {
  return (codes ?? [])
    .map((code) => ALL_LANGUAGES.find((l) => l.code === languageToCode(code)))
    .filter((l): l is DiveLanguage => l !== undefined)
    .map((l) => ({ code: l.code, label: CHINESE_SCRIPT_LABELS[l.code as LanguageCode] ?? l.label }))
}

/** Curated list for profile forms — matches the original 17-language set. */
export const PROFILE_LANGUAGE_OPTIONS = [
  { code: 'en-GB' as LanguageCode, label: 'English' },
  { code: 'th-TH' as LanguageCode, label: 'Thai' },
  { code: 'zh-CN' as LanguageCode, label: 'Mandarin' },
  { code: 'ja-JP' as LanguageCode, label: 'Japanese' },
  { code: 'ko-KR' as LanguageCode, label: 'Korean' },
  { code: 'fr-FR' as LanguageCode, label: 'French' },
  { code: 'de-DE' as LanguageCode, label: 'German' },
  { code: 'ru-RU' as LanguageCode, label: 'Russian' },
  { code: 'it-IT' as LanguageCode, label: 'Italian' },
  { code: 'es-ES' as LanguageCode, label: 'Spanish' },
  { code: 'pt-BR' as LanguageCode, label: 'Portuguese' },
  { code: 'nl-NL' as LanguageCode, label: 'Dutch' },
  { code: 'ar-SA' as LanguageCode, label: 'Arabic' },
  { code: 'he-IL' as LanguageCode, label: 'Hebrew' },
  { code: 'sv-SE' as LanguageCode, label: 'Swedish' },
  { code: 'pl-PL' as LanguageCode, label: 'Polish' },
] as const

/** Row 1: Asian languages (Chinese Simplified leads) */
export const POPULAR_ROW1_CODES: LanguageCode[] = ['zh-CN', 'th-TH', 'ja-JP', 'ko-KR', 'id-ID', 'ru-RU', 'dv-MV', 'vi-VN']
/** Row 2: European languages (Chinese Traditional leads) */
export const POPULAR_ROW2_CODES: LanguageCode[] = ['zh-TW', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'nl-NL', 'nb-NO']

export const POPULAR_LANGUAGE_CODES: LanguageCode[] = [...POPULAR_ROW1_CODES, ...POPULAR_ROW2_CODES]

/** Chinese codes render native script labels instead of flag emoji */
export const CHINESE_SCRIPT_LABELS: Partial<Record<LanguageCode, string>> = {
  'zh-CN': '简体',
  'zh-TW': '繁體',
}
