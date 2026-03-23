const TOP_LANGUAGE_ENTRIES = [
  { code: 'GB', label: 'English' },
  { code: 'FR', label: 'French' },
  { code: 'DE', label: 'German' },
  { code: 'ES', label: 'Spanish' },
  { code: 'IT', label: 'Italian' },
  { code: 'NO', label: 'Norwegian' },
  { code: 'RU', label: 'Russian' },
  { code: 'CN', label: 'Mandarin' },
  { code: 'HK', label: 'Cantonese' },
  { code: 'TH', label: 'Thai' },
  { code: 'JP', label: 'Japanese' },
  { code: 'KR', label: 'Korean' },
  { code: 'ID', label: 'Indonesian' },
  { code: 'SA', label: 'Arabic' },
  { code: 'IL', label: 'Hebrew' },
] as const

const OTHER_LANGUAGE_ENTRIES = [
  { code: 'TW', label: 'Chinese (Traditional)' },
  { code: 'BR', label: 'Portuguese' },
  { code: 'NL', label: 'Dutch' },
  { code: 'SE', label: 'Swedish' },
  { code: 'IN', label: 'Hindi' },
  { code: 'MY', label: 'Malay' },
  { code: 'VN', label: 'Vietnamese' },
  { code: 'MV', label: 'Dhivehi' },
  { code: 'PL', label: 'Polish' },
  { code: 'DK', label: 'Danish' },
  { code: 'FI', label: 'Finnish' },
  { code: 'IS', label: 'Icelandic' },
  { code: 'CZ', label: 'Czech' },
  { code: 'TR', label: 'Turkish' },
  { code: 'GR', label: 'Greek' },
  { code: 'HU', label: 'Hungarian' },
  { code: 'RO', label: 'Romanian' },
  { code: 'UA', label: 'Ukrainian' },
  { code: 'PH', label: 'Filipino' },
  { code: 'MM', label: 'Burmese' },
  { code: 'KH', label: 'Khmer' },
  { code: 'BD', label: 'Bengali' },
  { code: 'KE', label: 'Swahili' },
  { code: 'ZA', label: 'Afrikaans' },
  { code: 'HR', label: 'Croatian' },
  { code: 'RS', label: 'Serbian' },
  { code: 'SI', label: 'Slovenian' },
  { code: 'IR', label: 'Farsi' },
  { code: 'PK', label: 'Urdu' },
  { code: 'JM', label: 'Jamaican Patois' },

  // European
  { code: 'LT', label: 'Lithuanian' },
  { code: 'LV', label: 'Latvian' },
  { code: 'EE', label: 'Estonian' },
  { code: 'SK', label: 'Slovak' },
  { code: 'BG', label: 'Bulgarian' },
  { code: 'AL', label: 'Albanian' },
  { code: 'BY', label: 'Belarusian' },
  { code: 'MK', label: 'Macedonian' },
  { code: 'MT', label: 'Maltese' },
  { code: 'IE', label: 'Irish' },
  { code: 'CY', label: 'Welsh' },
  { code: 'AD', label: 'Catalan' },
  { code: 'FO', label: 'Faroese' },
  { code: 'LU', label: 'Luxembourgish' },
  { code: 'EU', label: 'Basque' },

  // African
  { code: 'ET', label: 'Amharic' },
  { code: 'SO', label: 'Somali' },
  { code: 'ZW', label: 'Shona' },
  { code: 'RW', label: 'Kinyarwanda' },
  { code: 'CD', label: 'Lingala' },
  { code: 'SN', label: 'Wolof' },
  { code: 'MG', label: 'Malagasy' },
  { code: 'ER', label: 'Tigrinya' },

  // Asian / Central Asian
  { code: 'NP', label: 'Nepali' },
  { code: 'LK', label: 'Sinhala' },
  { code: 'LA', label: 'Lao' },
  { code: 'MN', label: 'Mongolian' },
  { code: 'UZ', label: 'Uzbek' },
  { code: 'KZ', label: 'Kazakh' },
  { code: 'AZ', label: 'Azerbaijani' },
  { code: 'GE', label: 'Georgian' },
  { code: 'AM', label: 'Armenian' },
  { code: 'AF', label: 'Pashto' },
  { code: 'IQ', label: 'Kurdish' },
  { code: 'MR', label: 'Marathi' },
  { code: 'ML', label: 'Malayalam' },

  // Americas / Pacific
  { code: 'HT', label: 'Haitian Creole' },
  { code: 'PE', label: 'Quechua' },
  { code: 'PY', label: 'Guaraní' },
  { code: 'NZ', label: 'Māori' },
  { code: 'WS', label: 'Samoan' },
  { code: 'TO', label: 'Tongan' },
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
  CN: 'chinese mandarin simplified',
  TW: 'chinese traditional taiwan',
  HK: 'chinese cantonese hong kong',
  MV: 'maldives maldivian divehi',
  JM: 'jamaican',
  PH: 'tagalog filipino philippines',
  CY: 'cymraeg uk britain',
  ET: 'ethiopian',
  ER: 'eritrean ethiopian',
  NZ: 'new zealand',
  PY: 'guarani paraguay',
  ML: 'kerala india',
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

// Build reverse lookup: language label → country code (case-insensitive)
const _labelToCode = new Map<string, string>(
  ALL_LANGUAGES.map((l) => [l.label.toLowerCase(), l.code]),
)

// ISO-639 language codes → country codes for backward compatibility
// Profile forms historically stored ISO-639 ('en', 'th', 'zh'), but the
// canonical format is country codes ('GB', 'TH', 'CN').
const ISO_TO_COUNTRY: Record<string, string> = {
  en: 'GB', th: 'TH', zh: 'CN', yue: 'HK', ja: 'JP', ko: 'KR',
  fr: 'FR', de: 'DE', ru: 'RU', it: 'IT', es: 'ES', pt: 'BR',
  nl: 'NL', ar: 'SA', he: 'IL', sv: 'SE', pl: 'PL',
}

/** Convert a language name/label/code to its country code for flag rendering.
 *  Handles all formats: "English" → "GB", "GB" → "GB", "en" → "GB". */
export function languageToCode(input: string): string {
  if (!input) return ''
  const upper = input.toUpperCase()
  if (upper.length === 2 && VALID_LANGUAGE_CODE_SET.has(upper)) return upper
  const isoHit = ISO_TO_COUNTRY[input.toLowerCase()]
  if (isoHit) return isoHit
  return _labelToCode.get(input.toLowerCase()) ?? ''
}

/** Curated list for profile forms — matches the original 17-language set. */
export const PROFILE_LANGUAGE_OPTIONS = [
  { code: 'GB' as LanguageCode, label: 'English' },
  { code: 'TH' as LanguageCode, label: 'Thai' },
  { code: 'CN' as LanguageCode, label: 'Mandarin' },
  { code: 'HK' as LanguageCode, label: 'Cantonese' },
  { code: 'JP' as LanguageCode, label: 'Japanese' },
  { code: 'KR' as LanguageCode, label: 'Korean' },
  { code: 'FR' as LanguageCode, label: 'French' },
  { code: 'DE' as LanguageCode, label: 'German' },
  { code: 'RU' as LanguageCode, label: 'Russian' },
  { code: 'IT' as LanguageCode, label: 'Italian' },
  { code: 'ES' as LanguageCode, label: 'Spanish' },
  { code: 'BR' as LanguageCode, label: 'Portuguese' },
  { code: 'NL' as LanguageCode, label: 'Dutch' },
  { code: 'SA' as LanguageCode, label: 'Arabic' },
  { code: 'IL' as LanguageCode, label: 'Hebrew' },
  { code: 'SE' as LanguageCode, label: 'Swedish' },
  { code: 'PL' as LanguageCode, label: 'Polish' },
] as const

/** Row 1: Asian languages (Chinese Simplified leads) */
export const POPULAR_ROW1_CODES: LanguageCode[] = ['CN', 'TH', 'JP', 'KR', 'ID', 'RU', 'MV', 'VN']
/** Row 2: European languages (Chinese Traditional leads) */
export const POPULAR_ROW2_CODES: LanguageCode[] = ['TW', 'GB', 'FR', 'DE', 'ES', 'IT', 'NL', 'NO']

export const POPULAR_LANGUAGE_CODES: LanguageCode[] = [...POPULAR_ROW1_CODES, ...POPULAR_ROW2_CODES]

/** Chinese codes render native script labels instead of flag emoji */
export const CHINESE_SCRIPT_LABELS: Partial<Record<LanguageCode, string>> = {
  CN: '简体',
  TW: '繁體',
}
