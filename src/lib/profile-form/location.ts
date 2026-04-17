import { locationSchema, type LocationValue } from '@/lib/schemas/location'

export type ProfileLocationValue = LocationValue

const DEFAULT_LOCATION_REQUIRED = 'Location is required'

export function nullableProfileLocation(
  message: string = DEFAULT_LOCATION_REQUIRED,
) {
  return locationSchema
    .nullable()
    .refine((v) => v !== null, { message })
}

export function locationFromProfileDoc(p: {
  placeName: string
  country: string
  lat: number
  lng: number
}): ProfileLocationValue {
  return {
    placeName: p.placeName,
    country: p.country,
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
    name: p.name as string,
    location: locationFromProfileDoc({
      placeName: p.placeName as string,
      country: p.country as string,
      lat: p.lat as number,
      lng: p.lng as number,
    }),
    email: p.email as string,
    phone: p.phone as string,
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

export function locationToPayload(loc: ProfileLocationValue) {
  return {
    placeName: loc.placeName,
    country: loc.country,
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
