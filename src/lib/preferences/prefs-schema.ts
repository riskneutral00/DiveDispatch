import { z } from 'zod'

export const prefsSchema = z.object({
  autoAccept: z.boolean(),
  commonLanguageCodes: z.array(z.string()).optional(),
  confirmOnAccept: z.boolean(),
  confirmOnDecline: z.boolean(),
  preferredInstructorSlugs: z.array(z.string()).optional(),
  preferredVenueSlugs: z.array(z.string()).optional(),
  preferredEquipmentSlugs: z.array(z.string()).optional(),
  preferredBoatSlugs: z.array(z.string()).optional(),
  preferredCompressorSlugs: z.array(z.string()).optional(),
  preferredOperatorSlug: z.string().optional(),
  autoAssignPreferred: z.boolean(),
})

export type PrefsFormData = z.infer<typeof prefsSchema>
