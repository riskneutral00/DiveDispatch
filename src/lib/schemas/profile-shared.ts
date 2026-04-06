import { z } from 'zod'
import { locationSchema } from './location'
import { AGENCIES, AOW_REQUIRED_SPECIALTY_COUNT } from '@/lib/constants/agencies'
import { BOAT_TYPES } from '@/lib/constants/boat-types'
import { GAS_MIXES } from '@/lib/constants/gas-mixes'
import { VENUE_TYPES } from '../../../convex/shared/venueTypes'
import {
  customerLanguagesFieldSchema,
  teachingLanguagesFieldSchema,
} from '@/lib/profile-form/languages'

export { locationSchema, type LocationValue } from './location'

/** Base contact fields shared by all profile forms. */
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

/** DiveMaster credential — agency + level + ID (no specialty ratings). */
export const credentialSchema = z.object({
  agency: z.string().min(1, 'Agency is required'),
  level: z.string().min(1, 'Certification level is required'),
  agencyID: z.string().min(1, 'Agency ID is required'),
})

/** Instructor credential — extends DM credential with specialty ratings. */
export const instructorCredentialSchema = credentialSchema.extend({
  specialtyRatings: z.array(z.string()),
})

// ---------------------------------------------------------------------------
// DiveCenter per-section schemas
// ---------------------------------------------------------------------------

// DiveCenter contact section uses contactSchema directly (no alias needed).

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
        const required = AOW_REQUIRED_SPECIALTY_COUNT
        return a.selectedSpecialties.length >= required
      }),
    { message: 'Not enough specialties selected', path: ['associations'] },
  )

// ---------------------------------------------------------------------------
// Agent per-section schemas
// ---------------------------------------------------------------------------

/** Agent contact section — extends base contact with optional defaultReferral (DC slug). */
export const agentContactSchema = contactSchema.extend({
  defaultReferral: z.string().nullable().optional(),
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
export const personalContactSchema = contactSchema.extend({
  name: z.string().min(1, 'Name is required'),
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
// Boat per-section schemas
// ---------------------------------------------------------------------------

// Boat contact section uses contactSchema directly (no alias needed).

const BOAT_TYPES_TUPLE = BOAT_TYPES

const boatRouteSchema = z.object({
  diveSite: z.string().min(1, 'Dive site required'),
  daysOfWeek: z.array(z.number()).min(1, 'Select at least one day'),
})

const boatFleetEntrySchema = z.object({
  boatName: z.string().min(1, 'Boat name required'),
  maxPax: z.number().int().min(1, 'At least 1 passenger'),
  minPax: z.number().int().min(1).optional(),
  seatCapacity: z.number().int().min(0).optional(),
  boatType: z.enum(BOAT_TYPES_TUPLE),
  routes: z.array(boatRouteSchema).optional(),
  cutoffHours: z.number().min(0).optional(),
})

/** Boat fleet section. */
export const boatFleetSchema = z.object({
  fleet: z.array(boatFleetEntrySchema),
})

// ---------------------------------------------------------------------------
// Compressor per-section schemas
// ---------------------------------------------------------------------------

// Compressor contact section uses contactSchema directly (no alias needed).

/** Compressor gas mixes section. */
export const compressorGasMixesSchema = z.object({
  gasMixes: z.array(z.enum(GAS_MIXES)).min(1, 'Select at least one gas mix'),
})

// ---------------------------------------------------------------------------
// Equipment per-section schemas
// ---------------------------------------------------------------------------

// Equipment contact section uses contactSchema directly (no alias needed).

/** Equipment gear catalog section. */
export const equipmentGearCatalogSchema = z.object({
  manufacturersByGearType: z.record(z.string(), z.array(z.string())),
})

// ---------------------------------------------------------------------------
// Pool per-section schemas
// ---------------------------------------------------------------------------

// Pool contact section uses contactSchema directly (no alias needed).

/** Pool capabilities section. */
export const poolCapabilitiesSchema = z.object({
  maxDepth: z.number().positive('Must be greater than 0'),
  maxCapacity: z.number().int('Must be a whole number').positive('Must be at least 1'),
})

// ---------------------------------------------------------------------------
// Dive Site per-section schemas
// ---------------------------------------------------------------------------

/** Dive Site details section — identity fields only (no email/phone). */
export const diveSiteDetailsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  venueType: z.enum(VENUE_TYPES),
})

/** Dive Site capabilities section. */
export const diveSiteCapabilitiesSchema = z.object({
  confinedCapable: z.boolean(),
  maxDepth: z.number().min(0).optional(),
  maxCapacity: z.number().int('Must be a whole number').positive('Must be at least 1'),
})
