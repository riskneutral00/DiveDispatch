import { locationSchema } from '@/lib/schemas/location'

/** Same shape as `LocationValue` from `location-picker` — keep in sync. */
export type ProfileLocationValue = {
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
}

const DEFAULT_LOCATION_REQUIRED = 'Location is required'

/** Nullable location field with “must pick a location” refine — use inside larger `z.object({ ... })`. */
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
  placeId?: string | null
}): ProfileLocationValue {
  return {
    placeName: p.placeName,
    country: p.country,
    lat: p.lat,
    lng: p.lng,
    ...(p.placeId != null && p.placeId !== '' ? { placeId: p.placeId } : {}),
  }
}

/** Name + standard geo columns + email/phone — shared by all role profile `fromProfile` mappers. */
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
      placeId: p.placeId as string | null | undefined,
    }),
    email: p.email as string,
    phone: p.phone as string,
  }
}

/** Default `fromMe` callback shared by all contact-section profile forms. */
export function defaultFromMe(
  u: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...defaults,
    email: (u.email as string) ?? '',
    phone: (u.phone as string) ?? '',
  }
}

/** Spread into toPayload return — replaces the 5-field loc spread duplicated across all profile forms. */
export function locationToPayload(loc: ProfileLocationValue) {
  return {
    placeName: loc.placeName,
    country: loc.country,
    lat: loc.lat,
    lng: loc.lng,
    placeId: loc.placeId,
  }
}

// ── Shared contact form state (used by 6+ profile forms) ───────────

export type ContactFormState = {
  name: string
  location: ProfileLocationValue | null
  email: string
  phone: string
}

export const INITIAL_CONTACT_FORM: ContactFormState = {
  name: '',
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

