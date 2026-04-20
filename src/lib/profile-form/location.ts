import countries from 'i18n-iso-countries'
import enCountries from 'i18n-iso-countries/langs/en.json'
import { addressLocationSchema, type AddressLocationValue } from '@/lib/schemas/location'

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
    placeId: p.placeId,
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

export function defaultFromMe<T extends Record<string, unknown>>(
  u: Record<string, unknown>,
  defaults: T,
): T {
  return {
    ...defaults,
    email: (u.email as string) ?? '',
    phone: (u.phone as string) ?? '',
  } as T
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
