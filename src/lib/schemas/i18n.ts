import { z } from 'zod'
import {
  isValidCountryCode,
  isValidPhoneE164,
  isValidLocale,
  isValidLanguageCode,
} from '@/lib/constants/i18n'
import { ERROR_REQUIRED } from '@/lib/validation/error-codes'

interface PhoneSchemaOptions {
  requiredMessage?: string
  invalidMessage?: string
}

export function phoneSchema({
  requiredMessage = ERROR_REQUIRED,
  invalidMessage = 'Phone must be valid E.164 format',
}: PhoneSchemaOptions = {}) {
  return z
    .string()
    .min(1, requiredMessage)
    .refine(isValidPhoneE164, { message: invalidMessage })
}

export const e164Schema = phoneSchema()

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
  city: z.string().min(1, ERROR_REQUIRED),
  state: z.string().optional(),
  country: countryCodeSchema,
  postalCode: z.string().optional(),
})

export type AddressValue = z.infer<typeof addressSchema>
