import { z } from 'zod'

export const locationSchema = z.object({
  placeName: z.string().min(1),
  country: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
})

export type LocationValue = z.infer<typeof locationSchema>
