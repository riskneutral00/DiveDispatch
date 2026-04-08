import { z } from 'zod'
import { locationSchema } from './location'
import { AOW_REQUIRED_SPECIALTY_COUNT } from '@/lib/constants/agencies'
import { BOAT_TYPES } from '@/lib/constants/boat-types'
import { GAS_MIXES } from '@/lib/constants/gas-mixes'
import { VENUE_TYPES } from '../../../convex/shared/venueTypes'
import {
  customerLanguagesFieldSchema,
  teachingLanguagesFieldSchema,
} from '@/lib/profile-form/languages'

export { locationSchema, type LocationValue } from './location'

export const contactSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Contact phone is required'),
})

export const associationSchema = z.object({
  agency: z.string().min(1, 'Agency is required'),
  number: z.string().min(1, 'Member ID is required'),
})

export const credentialSchema = z.object({
  agency: z.string().min(1, 'Agency is required'),
  level: z.string().min(1, 'Certification level is required'),
  agencyID: z.string().min(1, 'Agency ID is required'),
})

export const instructorCredentialSchema = credentialSchema.extend({
  specialtyRatings: z.array(z.string()),
})

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

export const agentContactSchema = contactSchema.extend({
  defaultReferral: z.string().nullable().optional(),
})

export const agentLanguagesSchema = z.object({
  customerLanguages: customerLanguagesFieldSchema,
})

export const agentAssociationsSchema = z.object({
  associations: z.array(associationSchema),
})

export const personalContactSchema = contactSchema.extend({
  name: z.string().min(1, 'Name is required'),
})

export const personalLanguagesSchema = z.object({
  teachingLanguages: teachingLanguagesFieldSchema,
})

export const diveMasterCredentialsSchema = z.object({
  credential: z.array(credentialSchema).min(1, 'At least one credential is required'),
})

export const instructorCredentialsSchema = z.object({
  credential: z.array(instructorCredentialSchema).min(1, 'At least one credential is required'),
})

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
}).refine(
  (data) => {
    if (!data.routes?.length) return true
    const seen = new Set<number>()
    for (const route of data.routes) {
      for (const day of route.daysOfWeek) {
        if (seen.has(day)) return false
        seen.add(day)
      }
    }
    return true
  },
  { message: 'Each day can only be assigned to one route per vessel', path: ['routes'] },
)

export const boatFleetSchema = z.object({
  fleet: z.array(boatFleetEntrySchema),
})

export const compressorGasMixesSchema = z.object({
  gasMixes: z.array(z.enum(GAS_MIXES)).min(1, 'Select at least one gas mix'),
})

export const equipmentGearCatalogSchema = z.object({
  manufacturersByGearType: z.record(z.string(), z.array(z.string())),
})

export const poolCapabilitiesSchema = z.object({
  maxDepth: z.number().positive('Must be greater than 0'),
  maxCapacity: z.number().int('Must be a whole number').positive('Must be at least 1'),
})

export const diveSiteDetailsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  venueType: z.enum(VENUE_TYPES),
})

export const diveSiteCapabilitiesSchema = z.object({
  confinedCapable: z.boolean(),
  maxDepth: z.number().min(0).optional(),
  maxCapacity: z.number().int('Must be a whole number').positive('Must be at least 1'),
})
