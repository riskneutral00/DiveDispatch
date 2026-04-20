import { z } from 'zod'
import { addressSchema } from './i18n'

export const locationSchema = z.object({
  placeName: z.string().min(1, 'Location name is required'),
  country: z.string().min(1, 'Country is required'),
  lat: z.number(),
  lng: z.number(),
})

export type LocationValue = z.infer<typeof locationSchema>

export const addressLocationSchema = z.object({
  address: addressSchema,
  placeId: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
})

export type AddressLocationValue = z.infer<typeof addressLocationSchema>
