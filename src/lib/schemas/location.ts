import { z } from 'zod'

export const locationSchema = z.object({
  placeName: z.string().min(1, 'Location name is required'),
  country: z.string().min(1, 'Country is required'),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
})

export type LocationValue = z.infer<typeof locationSchema>
