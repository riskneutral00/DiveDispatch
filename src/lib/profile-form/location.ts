import { locationSchema as profileLocationFieldsSchema } from '@/lib/schemas/location'

/** Same shape as `LocationValue` from `location-picker` — keep in sync. */
export type ProfileLocationValue = {
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
}

export { profileLocationFieldsSchema }

const DEFAULT_LOCATION_REQUIRED = 'Location is required'

/** Nullable location field with “must pick a location” refine — use inside larger `z.object({ ... })`. */
export function nullableProfileLocation(
  message: string = DEFAULT_LOCATION_REQUIRED,
) {
  return profileLocationFieldsSchema
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

export type OptimisticLocationPatch = {
  placeName: string
  country: string
  lat: number
  lng: number
  placeId?: string
}

/**
 * Sets `location` on the form and, when editing an existing profile, patches Convex
 * with the same coordinates (same pattern across role profile forms).
 */
export function createOptimisticLocationOnChange<
  TForm extends Record<string, unknown> & { location: ProfileLocationValue | null },
>(opts: {
  setField: <K extends keyof TForm>(key: K, value: TForm[K]) => void
  update: (patch: OptimisticLocationPatch) => Promise<unknown>
  isUpdate: boolean
}) {
  return (loc: ProfileLocationValue | null) => {
    opts.setField('location', loc as TForm['location'])
    if (loc && opts.isUpdate) {
      void opts.update({
        placeName: loc.placeName,
        country: loc.country,
        lat: loc.lat,
        lng: loc.lng,
        placeId: loc.placeId,
      })
    }
  }
}
