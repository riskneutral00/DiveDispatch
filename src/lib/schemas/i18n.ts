import { z } from 'zod'
import {
  isValidCountryCode,
  isValidPhoneE164,
  isValidLocale,
  isValidLanguageCode,
} from '@/lib/constants/i18n'

export const e164Schema = z
  .string()
  .min(1, 'Phone is required')
  .refine(isValidPhoneE164, { message: 'Phone must be valid E.164 format' })

export const countryCodeSchema = z
  .string()
  .length(2, 'Country code must be 2 letters')
  .transform((v) => v.toUpperCase())
  .refine(isValidCountryCode, { message: 'Invalid ISO 3166-1 country code' })

export const localeSchema = z
  .string()
  .refine(isValidLocale, { message: 'Unsupported locale' })

export const languageCodeSchema = z
  .string()
  .refine(isValidLanguageCode, { message: 'Invalid BCP 47 language code' })

export const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  country: countryCodeSchema,
  postalCode: z.string().optional(),
})

export type AddressValue = z.infer<typeof addressSchema>
