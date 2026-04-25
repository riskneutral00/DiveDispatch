import { z } from 'zod'
import { addressLocationSchema } from './location'
import { e164Schema } from './i18n'
import { AOW_REQUIRED_SPECIALTY_COUNT } from '@/lib/constants/agencies'
import { BOAT_TYPES } from '@/lib/constants/boat-types'
import { GAS_MIXES } from '@/lib/constants/gas-mixes'
import { VENUE_KINDS } from '../../../convex/shared/venueTypes'
import { VENUE_FEATURES } from '../../../convex/shared/venueFeatures'
import {
  customerLanguagesFieldSchema,
  teachingLanguagesFieldSchema,
} from '@/lib/profile-form/languages'

export { addressLocationSchema, type AddressLocationValue } from './location'

export const contactSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  location: addressLocationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  email: z.email('Invalid email address'),
  phone: e164Schema,
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

export const diveCenterContactMergedSchema = contactSchema.extend(diveCenterLanguagesSchema.shape)

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

export const agentContactSchema = contactSchema

export const agentLanguagesSchema = z.object({
  customerLanguages: customerLanguagesFieldSchema,
})

export const agentContactMergedSchema = agentContactSchema.extend(agentLanguagesSchema.shape)

export const agentAssociationsSchema = z.object({
  associations: z.array(associationSchema),
})

export const personalContactSchema = contactSchema.omit({ name: true })

export const personalLanguagesSchema = z.object({
  teachingLanguages: teachingLanguagesFieldSchema,
})

export const personalContactMergedSchema = personalContactSchema
  .extend(personalLanguagesSchema.shape)

export const instructorCredentialsSchema = z.object({
  credential: z.array(instructorCredentialSchema).min(1, 'At least one credential is required'),
})

const BOAT_TYPES_TUPLE = BOAT_TYPES

const boatRouteSchema = z.object({
  venueIds: z.array(z.string().min(1)).min(1, 'Select at least one venue'),
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

export const compressorGasMixesSchema = z
  .object({
    gasMixes: z.array(z.enum(GAS_MIXES)).min(1, 'Select at least one gas mix'),
    nitroxMin: z.number().int().min(22).max(40).optional(),
    nitroxMax: z.number().int().min(22).max(40).optional(),
  })
  .refine(
    (data) => {
      if (!data.gasMixes.includes('nitrox')) return true
      if (data.nitroxMin === undefined || data.nitroxMax === undefined)
        return false
      return data.nitroxMin <= data.nitroxMax
    },
    { message: 'Nitrox range required (min ≤ max, 22–40%)', path: ['nitroxMin'] },
  )

export const diveSiteDetailsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: addressLocationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  kind: z.enum(VENUE_KINDS),
  features: z.array(z.enum(VENUE_FEATURES)).default([]),
})

export const diveSiteCapabilitiesSchema = z.object({
  confinedCapable: z.boolean().optional(),
  maxDepth: z.number().min(0).optional(),
  maxCapacity: z.number().int('Must be a whole number').positive('Must be at least 1').optional(),
})

export const venueCapabilitiesSchema = z
  .object({
    kind: z.enum(VENUE_KINDS),
    features: z.array(z.enum(VENUE_FEATURES)).default([]),
    confinedCapable: z.boolean().optional(),
    maxDepth: z.number().min(1, 'Must be at least 1 m').optional(),
    maxCapacity: z.number().int('Must be a whole number').min(1, 'Must be at least 1').optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind !== 'pool') return

    if (v.maxDepth === undefined) {
      ctx.addIssue({ code: 'custom', path: ['maxDepth'], message: 'Required for pool' })
    } else {
      if (v.maxDepth > 60) {
        ctx.addIssue({ code: 'custom', path: ['maxDepth'], message: 'Pool max depth is 60 m' })
      }
      if ((v.maxDepth * 2) % 1 !== 0) {
        ctx.addIssue({ code: 'custom', path: ['maxDepth'], message: 'Must be in 0.5 m increments' })
      }
    }
    if (v.maxCapacity === undefined) {
      ctx.addIssue({ code: 'custom', path: ['maxCapacity'], message: 'Required for pool' })
    } else if (v.maxCapacity > 50) {
      ctx.addIssue({ code: 'custom', path: ['maxCapacity'], message: 'Pool max capacity is 50' })
    }
  })
