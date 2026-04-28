export function buildParentContactDefaults(
  me: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return {
    name: '',
    address: { street: undefined, city: '', state: undefined, country: '', postalCode: undefined },
    placeId: undefined,
    lat: 0,
    lng: 0,
    email: (me?.email as string | undefined) ?? '',
    phone: (me?.phone as string | undefined) ?? '',
  }
}
