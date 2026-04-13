import rawCountries from 'world-countries'

export type CountryOption = {
  code: string
  name: string
  flag: string
}

const SORTED_CODES: readonly string[] = rawCountries
  .map((c) => c.cca2)
  .sort()

const FLAG_BY_CODE = new Map<string, string>(
  rawCountries.map((c) => [c.cca2, c.flag]),
)

let displayNamesCache: { locale: string; names: Intl.DisplayNames } | null = null

function getDisplayNames(locale?: string): Intl.DisplayNames {
  const resolved = locale || (typeof navigator !== 'undefined' ? navigator.language : 'en')
  if (displayNamesCache && displayNamesCache.locale === resolved) {
    return displayNamesCache.names
  }
  const names = new Intl.DisplayNames([resolved], { type: 'region' })
  displayNamesCache = { locale: resolved, names }
  return names
}

export function listCountries(locale?: string): CountryOption[] {
  const dn = getDisplayNames(locale)
  return SORTED_CODES.map((code) => ({
    code,
    name: dn.of(code) || code,
    flag: FLAG_BY_CODE.get(code) || '',
  })).sort((a, b) => a.name.localeCompare(b.name, locale))
}

export function countryName(code: string, locale?: string): string {
  if (!code) return ''
  return getDisplayNames(locale).of(code) || code
}

export function countryFlag(code: string): string {
  return FLAG_BY_CODE.get(code) || ''
}

export function isValidCountryCode(code: string): boolean {
  return FLAG_BY_CODE.has(code)
}
