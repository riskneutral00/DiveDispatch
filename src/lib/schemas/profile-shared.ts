import { z } from 'zod'
import { locationSchema } from './location'
import { AGENCIES } from '@/lib/constants/agencies'
import {
  customerLanguagesFieldSchema,
  teachingLanguagesFieldSchema,
} from '@/lib/profile-form/languages'

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

// ---------------------------------------------------------------------------
// DiveCenter per-section schemas
// ---------------------------------------------------------------------------

/** DiveCenter contact section. */
export const diveCenterContactSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Contact phone is required'),
})

/** DiveCenter languages section. */
export const diveCenterLanguagesSchema = z.object({
  customerLanguages: customerLanguagesFieldSchema,
})

const diveCenterAssociationItemSchema = z.object({
  agency: z.string().min(1, 'Agency is required'),
  number: z.string().min(1, 'Member ID is required'),
  owDays: z.number().min(1),
  aowDays: z.number().min(1),
  oaDays: z.number().min(1),
  selectedSpecialties: z.array(z.string()),
})

/** DiveCenter affiliations section — includes specialty count refine. */
export const diveCenterAffiliationsSchema = z
  .object({
    associations: z.array(diveCenterAssociationItemSchema).min(1, 'At least one agency association is required'),
  })
  .refine(
    (data) =>
      data.associations.every((a) => {
        const required = AGENCIES[a.agency]?.specialtyCount ?? 5
        return a.selectedSpecialties.length >= required
      }),
    { message: 'Not enough specialties selected', path: ['associations'] },
  )

// ---------------------------------------------------------------------------
// Agent per-section schemas
// ---------------------------------------------------------------------------

/** Agent contact section — extends base contact with defaultReferralMode. */
export const agentContactSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Contact phone is required'),
  defaultReferralMode: z.enum(['independent', 'referral']),
})

/** Agent languages section. */
export const agentLanguagesSchema = z.object({
  customerLanguages: customerLanguagesFieldSchema,
})

/** Agent associations section. */
export const agentAssociationsSchema = z.object({
  associations: z.array(associationSchema),
})

// ---------------------------------------------------------------------------
// Personal (Instructor / DiveMaster) per-section schemas
// ---------------------------------------------------------------------------

/** Personal contact section (Instructor and DiveMaster). */
export const personalContactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Contact phone is required'),
})

/** Personal languages section — teaching languages for Instructor/DiveMaster. */
export const personalLanguagesSchema = z.object({
  teachingLanguages: teachingLanguagesFieldSchema,
})

/** DiveMaster credentials section. */
export const diveMasterCredentialsSchema = z.object({
  credential: z.array(credentialSchema).min(1, 'At least one credential is required'),
})

/** Instructor credentials section. */
export const instructorCredentialsSchema = z.object({
  credential: z.array(instructorCredentialSchema).min(1, 'At least one credential is required'),
})

// ---------------------------------------------------------------------------
// Compressor per-section schemas
// ---------------------------------------------------------------------------

/** Compressor contact section. */
export const compressorContactSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Contact phone is required'),
})

/** Compressor gas mixes section. */
export const compressorGasMixesSchema = z.object({
  gasMixes: z.array(z.enum(['air', 'nitrox', 'trimix'])).min(1, 'Select at least one gas mix'),
})

// ---------------------------------------------------------------------------
// Equipment per-section schemas
// ---------------------------------------------------------------------------

/** Equipment contact section. */
export const equipmentContactSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Contact phone is required'),
})

/** Equipment gear catalog section. */
export const equipmentGearCatalogSchema = z.object({
  manufacturersByGearType: z.record(z.string(), z.array(z.string())),
})
