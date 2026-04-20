import { z } from 'zod'
import { addressSchema } from './i18n'

export const addressLocationSchema = z.object({
  address: addressSchema,
  placeId: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
})

export type AddressLocationValue = z.infer<typeof addressLocationSchema>
