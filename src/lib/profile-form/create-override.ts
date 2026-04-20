type AddressLike = {
  street?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
}

type LocationLike = {
  address?: AddressLike
  placeId?: string
  placeName?: string
  country?: string
  lat?: number
  lng?: number
}

export function buildParentContactDefaults(
  me: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const defaultLoc = me?.defaultLocation as LocationLike | undefined
  const addr = defaultLoc?.address
  const fallbackCity = defaultLoc?.placeName
  const fallbackCountry = defaultLoc?.country
  return {
    name: '',
    address: {
      street: addr?.street,
      city: addr?.city ?? fallbackCity ?? '',
      state: addr?.state,
      country: addr?.country ?? fallbackCountry ?? '',
      postalCode: addr?.postalCode,
    },
    placeId: defaultLoc?.placeId,
    lat: defaultLoc?.lat ?? 0,
    lng: defaultLoc?.lng ?? 0,
    email: (me?.email as string | undefined) ?? '',
    phone: (me?.phone as string | undefined) ?? '',
  }
}
