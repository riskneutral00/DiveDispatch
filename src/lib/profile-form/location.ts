import countries from 'i18n-iso-countries'
import enCountries from 'i18n-iso-countries/langs/en.json'
import { addressLocationSchema, type AddressLocationValue } from '@/lib/schemas/location'
import { APP_LANGUAGE_TO_LOCALE, findLanguageByCode, CHINESE_SCRIPT_LABELS } from '@/lib/constants/dive-languages'
import type { SupportedLocale } from '@/lib/constants/locales'
import type { LanguageCode } from '@/lib/constants/dive-languages'

countries.registerLocale(enCountries as unknown as Parameters<typeof countries.registerLocale>[0])

export type ProfileLocationValue = AddressLocationValue

function toIsoCountryCode(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (/^[A-Z]{2}$/.test(value) && countries.isValid(value)) return value
  const iso = countries.getAlpha2Code(value, 'en')
  return iso || undefined
}

const DEFAULT_LOCATION_REQUIRED = 'Location is required'

export function nullableProfileLocation(
  message: string = DEFAULT_LOCATION_REQUIRED,
) {
  return addressLocationSchema
    .nullable()
    .refine((v) => v !== null, { message })
}

type ProfileAddressLike = {
  street?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
}

type ProfileLocationDoc = {
  address?: ProfileAddressLike
  placeName?: string
  country?: string
  placeId?: string
  lat: number
  lng: number
}

export function locationFromProfileDoc(p: ProfileLocationDoc): ProfileLocationValue {
  const addr = p.address
  const cityFromLegacy = p.placeName
  const isoFromLegacy = toIsoCountryCode(p.country)
  return {
    address: {
      street: addr?.street,
      city: addr?.city ?? cityFromLegacy ?? '',
      state: addr?.state,
      country: addr?.country ?? isoFromLegacy ?? p.country ?? '',
      postalCode: addr?.postalCode,
    },
    placeId: (p.placeId as string | null | undefined) ?? undefined,
    lat: p.lat,
    lng: p.lng,
  }
}

export function contactFieldsFromProfile(p: Record<string, unknown>): {
  name: string
  location: ProfileLocationValue
  email: string
  phone: string
} {
  return {
    name: (p.name as string) ?? '',
    location: locationFromProfileDoc({
      address: p.address as ProfileAddressLike | undefined,
      placeName: p.placeName as string | undefined,
      country: p.country as string | undefined,
      placeId: p.placeId as string | undefined,
      lat: (p.lat as number) ?? 0,
      lng: (p.lng as number) ?? 0,
    }),
    email: (p.email as string) ?? '',
    phone: (p.phone as string) ?? '',
  }
}

export type LanguageKey = 'customerLanguages' | 'teachingLanguages'

export type DefaultFromMeOptions = {
  languageKey?: LanguageKey
}

function defaultLanguageFromAppLanguage(appLanguage: unknown): { code: string; label: string } | null {
  if (typeof appLanguage !== 'string' || !appLanguage) return null
  const localeCode = APP_LANGUAGE_TO_LOCALE[appLanguage as SupportedLocale]
  if (!localeCode) return null
  const language = findLanguageByCode(localeCode)
  if (!language) return null
  return {
    code: language.code,
    label: CHINESE_SCRIPT_LABELS[language.code as LanguageCode] ?? language.label,
  }
}

export function defaultFromMe<T extends Record<string, unknown>>(
  u: Record<string, unknown>,
  defaults: T,
  options?: DefaultFromMeOptions,
): T {
  const out: Record<string, unknown> = {
    ...defaults,
    email: (u.email as string) ?? '',
    phone: (u.phone as string) ?? '',
  }

  if (options?.languageKey) {
    const current = out[options.languageKey]
    if (Array.isArray(current) && current.length === 0) {
      const language = defaultLanguageFromAppLanguage(u.appLanguage)
      if (language) out[options.languageKey] = [language]
    }
  }

  return out as T
}

export function locationToPayload(loc: ProfileLocationValue): Record<string, unknown> {
  return {
    address: loc.address,
    placeId: loc.placeId,
    lat: loc.lat,
    lng: loc.lng,
  }
}

export type ContactFormState = {
  name: string
  location: ProfileLocationValue | null
  email: string
  phone: string
}

export type PersonalContactFormState = Omit<ContactFormState, 'name'>

export const INITIAL_CONTACT_FORM: ContactFormState = {
  name: '',
  location: null,
  email: '',
  phone: '',
}

export const INITIAL_PERSONAL_CONTACT_FORM: PersonalContactFormState = {
  location: null,
  email: '',
  phone: '',
}

export function contactFromProfile(p: Record<string, unknown>): ContactFormState {
  const c = contactFieldsFromProfile(p)
  return { name: c.name, location: c.location, email: c.email, phone: c.phone }
}

export function contactToPayload(f: ContactFormState): Record<string, unknown> {
  return { name: f.name, ...locationToPayload(f.location!), email: f.email, phone: f.phone }
}

export function personalContactFromProfile(p: Record<string, unknown>): PersonalContactFormState {
  const c = contactFieldsFromProfile(p)
  return { location: c.location, email: c.email, phone: c.phone }
}

export function personalContactToPayload(f: PersonalContactFormState): Record<string, unknown> {
  return { ...locationToPayload(f.location!), email: f.email, phone: f.phone }
}
