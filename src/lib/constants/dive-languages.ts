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

  { code: 'am-ET', label: 'Amharic' },
  { code: 'so-SO', label: 'Somali' },
  { code: 'sn-ZW', label: 'Shona' },
  { code: 'rw-RW', label: 'Kinyarwanda' },
  { code: 'ln-CD', label: 'Lingala' },
  { code: 'wo-SN', label: 'Wolof' },
  { code: 'mg-MG', label: 'Malagasy' },
  { code: 'ti-ER', label: 'Tigrinya' },

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

const TOP_LANGUAGES: DiveLanguage[] = withSearchTerms(TOP_LANGUAGE_ENTRIES)
const OTHER_LANGUAGES: DiveLanguage[] = withSearchTerms(OTHER_LANGUAGE_ENTRIES)
export const ALL_LANGUAGES: DiveLanguage[] = [...TOP_LANGUAGES, ...OTHER_LANGUAGES]

const VALID_LANGUAGE_CODE_SET = new Set<string>(ALL_LANGUAGES.map((l) => l.code))

const _labelToCode = new Map<string, string>(
  ALL_LANGUAGES.map((l) => [l.label.toLowerCase(), l.code]),
)

const ISO_TO_LOCALE: Record<string, string> = {
  en: 'en-GB', th: 'th-TH', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR',
  fr: 'fr-FR', de: 'de-DE', ru: 'ru-RU', it: 'it-IT', es: 'es-ES', pt: 'pt-BR',
  nl: 'nl-NL', ar: 'ar-SA', he: 'he-IL', sv: 'sv-SE', pl: 'pl-PL',
}

const COUNTRY_TO_LOCALE: Record<string, string> = Object.fromEntries(
  ALL_LANGUAGES.map((l) => [localeToCountryCode(l.code), l.code]),
)

export function localeToCountryCode(locale: string): string {
  if (locale.includes('-')) {
    const parts = locale.split('-')
    return parts[parts.length - 1].toUpperCase()
  }
  return locale.toUpperCase()
}

export function languageToCode(input: string): string {
  if (!input) return ''

  if (VALID_LANGUAGE_CODE_SET.has(input)) return input

  const candidates = ALL_LANGUAGES.filter((l) => l.code.toLowerCase() === input.toLowerCase())
  if (candidates.length > 0) return candidates[0].code

  const lower = input.toLowerCase()

  const isoHit = ISO_TO_LOCALE[lower]
  if (isoHit) return isoHit

  const upper = input.toUpperCase()
  const countryHit = COUNTRY_TO_LOCALE[upper]
  if (countryHit) return countryHit

  if (lower.includes('-')) {
    const region = lower.split('-').pop()!.toUpperCase()
    const regionHit = COUNTRY_TO_LOCALE[region]
    if (regionHit) return regionHit
    const lang = lower.split('-')[0]
    const localeHit = ISO_TO_LOCALE[lang]
    if (localeHit) return localeHit
  }

  return _labelToCode.get(lower) ?? ''
}

export function resolveLanguages(codes: string[]): { code: string; label: string }[] {
  return (codes ?? [])
    .map((code) => ALL_LANGUAGES.find((l) => l.code === languageToCode(code)))
    .filter((l): l is DiveLanguage => l !== undefined)
    .map((l) => ({ code: l.code, label: CHINESE_SCRIPT_LABELS[l.code as LanguageCode] ?? l.label }))
}

export const POPULAR_ROW1_CODES: LanguageCode[] = ['zh-CN', 'th-TH', 'ja-JP', 'ko-KR', 'id-ID', 'ru-RU', 'dv-MV', 'vi-VN']
export const POPULAR_ROW2_CODES: LanguageCode[] = ['zh-TW', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'nl-NL', 'nb-NO']

export const POPULAR_LANGUAGE_CODES: LanguageCode[] = [...POPULAR_ROW1_CODES, ...POPULAR_ROW2_CODES]

export const CHINESE_SCRIPT_LABELS: Partial<Record<LanguageCode, string>> = {
  'zh-CN': '简体',
  'zh-TW': '繁體',
}
