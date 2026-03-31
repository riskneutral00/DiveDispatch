import { z } from 'zod'
import { locationSchema } from './location'

export { locationSchema, type LocationValue } from './location'

/** Base contact fields shared by all 8 profile forms. */
export const contactSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Contact phone is required'),
})

/** DC/Agent association — agency membership. */
export const associationSchema = z.object({
  agency: z.string().min(1, 'Agency is required'),
  number: z.string().min(1, 'Member ID is required'),
})

/** DiveMaster credential — agency + level + ID (no courses). */
export const credentialSchema = z.object({
  agency: z.string().min(1, 'Agency is required'),
  level: z.string().min(1, 'Certification level is required'),
  agencyID: z.string().min(1, 'Agency ID is required'),
})

/** Instructor credential — extends DM credential with courses. */
export const instructorCredentialSchema = credentialSchema.extend({
  courses: z.array(z.string()).min(1, 'Select at least one course'),
})
