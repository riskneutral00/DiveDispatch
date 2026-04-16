type LocationLike = {
  placeName?: string
  country?: string
  lat?: number
  lng?: number
}

export function buildParentContactDefaults(
  me: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const defaultLoc = me?.defaultLocation as LocationLike | undefined
  return {
    name: '',
    placeName: defaultLoc?.placeName ?? '',
    country: defaultLoc?.country ?? '',
    lat: defaultLoc?.lat ?? 0,
    lng: defaultLoc?.lng ?? 0,
    email: (me?.email as string | undefined) ?? '',
    phone: (me?.phone as string | undefined) ?? '',
  }
}
