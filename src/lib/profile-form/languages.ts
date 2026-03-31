import { z } from 'zod'

import { resolveLanguages } from '@/lib/constants/dive-languages'
import type { Language } from '@/lib/types/language'

export const languageEntrySchema = z.object({
  code: z.string(),
  label: z.string(),
})

export const customerLanguagesFieldSchema = z
  .array(languageEntrySchema)
  .min(1, 'At least one language required')

export const teachingLanguagesFieldSchema = z
  .array(languageEntrySchema)
  .min(1, 'At least one teaching language required')

export function languagesFromProfile(codes: string[] | undefined): Language[] {
  return resolveLanguages(codes ?? [])
}

export function languagesToPayload(langs: Language[]): string[] {
  return langs.map((l) => l.code)
}
