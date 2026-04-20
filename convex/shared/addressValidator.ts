import { v, type Infer } from 'convex/values'

export const addressStructuredValidator = v.object({
  street: v.optional(v.string()),
  city: v.string(),
  state: v.optional(v.string()),
  country: v.string(),
  postalCode: v.optional(v.string()),
})

export type AddressStructured = Infer<typeof addressStructuredValidator>

export const structuredLocationFields = {
  address: v.optional(addressStructuredValidator),
  placeId: v.optional(v.string()),
}
