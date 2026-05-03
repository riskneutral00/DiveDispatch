import { z } from 'zod'
import { addressLocationSchema } from './location'
import { e164Schema } from './i18n'
import { ERROR_REQUIRED } from '@/lib/validation/error-codes'
import { AOW_REQUIRED_SPECIALTY_COUNT } from '@/lib/constants/agencies'
import { BOAT_TYPES } from '@/lib/constants/boat-types'
import { GAS_MIXES } from '@/lib/constants/gas-mixes'
import { VENUE_KINDS, type VenueKind } from '../../../convex/shared/venueTypes'
import { VENUE_FEATURES, type VenueFeature } from '../../../convex/shared/venueFeatures'
import { type GasMix } from '../../../convex/shared/gasMixes'
import type { AddressLocationValue } from './location'
import {
  customerLanguagesFieldSchema,
  teachingLanguagesFieldSchema,
} from '@/lib/profile-form/languages'

export { addressLocationSchema, type AddressLocationValue } from './location'

export const contactSchema = z.object({
  name: z.string().min(1, ERROR_REQUIRED),
  location: addressLocationSchema.nullable().refine((v) => v !== null, { message: ERROR_REQUIRED }),
  email: z.email('Invalid email address'),
  phone: e164Schema,
})

export const associationSchema = z.object({
  agency: z.string().min(1, ERROR_REQUIRED),
  number: z.string().min(1, ERROR_REQUIRED),
})

export type AgentAssociation = z.infer<typeof associationSchema>

export const agentAssociationUserEntered = ['agency', 'number'] as const

export function makeDefaultAgentAssociation(
  overrides?: Partial<AgentAssociation>,
): AgentAssociation {
  return { agency: '', number: '', ...overrides }
}

export const credentialSchema = z.object({
  agency: z.string().min(1, ERROR_REQUIRED),
  level: z.string().min(1, ERROR_REQUIRED),
  agencyID: z.string().min(1, ERROR_REQUIRED),
})

export const instructorCredentialSchema = credentialSchema.extend({
  specialtyRatings: z.array(z.string()),
})

export type InstructorCredential = z.infer<typeof instructorCredentialSchema>

export const instructorCredentialUserEntered = ['agency', 'level', 'agencyID'] as const

export function makeDefaultInstructorCredential(
  overrides?: Partial<InstructorCredential>,
): InstructorCredential {
  return { agency: '', level: '', agencyID: '', specialtyRatings: [], ...overrides }
}

export const diveCenterLanguagesSchema = z.object({
  customerLanguages: customerLanguagesFieldSchema,
})

export const diveCenterContactMergedSchema = contactSchema.extend(diveCenterLanguagesSchema.shape)

export const diveCenterAssociationItemSchema = z.object({
  agency: z.string().min(1, ERROR_REQUIRED),
  number: z.string().min(1, ERROR_REQUIRED),
  owDays: z.number().min(1),
  aowDays: z.number().min(1),
  oaDays: z.number().min(1),
  selectedSpecialties: z.array(z.string()),
})

export type DiveCenterAssociationItem = z.infer<typeof diveCenterAssociationItemSchema>

export const diveCenterAssociationUserEntered = [
  'agency',
  'number',
  'owDays',
  'aowDays',
  'oaDays',
] as const

export function makeDefaultDiveCenterAssociation(
  overrides?: Partial<DiveCenterAssociationItem>,
): DiveCenterAssociationItem {
  return {
    agency: '',
    number: '',
    owDays: undefined as unknown as number,
    aowDays: undefined as unknown as number,
    oaDays: undefined as unknown as number,
    selectedSpecialties: [],
    ...overrides,
  }
}

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

export const boatRouteSchema = z.object({
  venueIds: z.array(z.string().min(1)).min(1, 'Select at least one venue'),
  daysOfWeek: z.array(z.number()).min(1, 'Select at least one day'),
})

export type BoatRoute = z.infer<typeof boatRouteSchema>

export const boatRouteUserEntered = ['venueIds', 'daysOfWeek'] as const

export function makeDefaultBoatRoute(overrides?: Partial<BoatRoute>): BoatRoute {
  return { venueIds: [], daysOfWeek: [], ...overrides }
}

export const boatFleetEntrySchema = z.object({
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

export type BoatFleetEntry = z.infer<typeof boatFleetEntrySchema>

export const boatFleetEntryUserEntered = ['boatName', 'maxPax', 'boatType'] as const

export function makeDefaultBoatFleetEntry(
  overrides?: Partial<BoatFleetEntry>,
): BoatFleetEntry {
  return {
    boatName: '',
    maxPax: undefined as unknown as number,
    boatType: undefined as unknown as BoatFleetEntry['boatType'],
    ...overrides,
  }
}

export const boatFleetSchema = z
  .object({
    fleet: z.array(boatFleetEntrySchema),
    hasCompressor: z.boolean().optional(),
    gasMixes: z.array(z.enum(GAS_MIXES)).optional(),
    nitroxMin: z.number().int().min(22).max(40).optional(),
    nitroxMax: z.number().int().min(22).max(40).optional(),
  })
  .refine(
    (data) => {
      if (!data.hasCompressor) return true
      if (!data.gasMixes || data.gasMixes.length === 0) return false
      if (!data.gasMixes.includes('nitrox')) return true
      if (data.nitroxMin === undefined || data.nitroxMax === undefined) return false
      return data.nitroxMin <= data.nitroxMax
    },
    { message: 'Select at least one gas mix; nitrox range required (min ≤ max, 22–40%)', path: ['gasMixes'] },
  )

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
  name: z.string().min(1, ERROR_REQUIRED),
  location: addressLocationSchema.nullable().refine((v) => v !== null, { message: ERROR_REQUIRED }),
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

export type VenueCapabilities = z.infer<typeof venueCapabilitiesSchema>

export const venueCapabilitiesUserEntered = [] as const

export function makeDefaultVenueCapabilities(
  overrides?: Partial<VenueCapabilities>,
): VenueCapabilities {
  return {
    kind: 'dive_site',
    features: [],
    ...overrides,
  }
}

export interface VenueFormValue {
  name: string
  email: string
  phone: string
  location: AddressLocationValue | null
  maxDepth?: number
  maxCapacity?: number
  confinedCapable?: boolean
  features: VenueFeature[]
  isAllowed: string[]
  notAllowed: string[]
  hasCompressorOnSite: boolean
  compressorGasMixes?: GasMix[]
  compressorNitroxMin?: number
  compressorNitroxMax?: number
}

export function makeDefaultVenueForm(overrides?: Partial<VenueFormValue>): VenueFormValue {
  return {
    name: '',
    email: '',
    phone: '',
    location: null,
    maxDepth: undefined,
    maxCapacity: undefined,
    confinedCapable: undefined,
    features: [],
    isAllowed: [],
    notAllowed: [],
    hasCompressorOnSite: false,
    compressorGasMixes: [],
    compressorNitroxMin: undefined,
    compressorNitroxMax: undefined,
    ...overrides,
  }
}

export function makeVenueDraftFromPrior(args: {
  prior: { kind: VenueKind; form: VenueFormValue } | null
  targetKind: VenueKind
  inherited: { email?: string; phone?: string }
}): VenueFormValue {
  const { prior, targetKind, inherited } = args
  if (!prior) {
    return makeDefaultVenueForm({
      email: inherited.email ?? '',
      phone: inherited.phone ?? '',
    })
  }
  const sameKind = prior.kind === targetKind
  const targetIsPool = targetKind === 'pool'
  return {
    ...prior.form,
    name: '',
    confinedCapable: sameKind ? prior.form.confinedCapable : (targetIsPool ? true : undefined),
    features: sameKind ? prior.form.features : [],
    maxDepth: sameKind ? prior.form.maxDepth : undefined,
    maxCapacity: sameKind && targetIsPool ? prior.form.maxCapacity : undefined,
  }
}

export function venueCapabilitiesToCreatePayload(form: {
  kind: VenueKind
  features: VenueFeature[]
  confinedCapable?: boolean
  maxDepth?: number
  maxCapacity?: number
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    kind: form.kind,
    features: form.features,
    maxDepth: form.maxDepth,
    maxCapacity: form.kind === 'pool' ? form.maxCapacity : undefined,
  }
  if (form.kind !== 'pool' && form.confinedCapable !== undefined) {
    payload.confinedCapable = form.confinedCapable
  }
  return payload
}
