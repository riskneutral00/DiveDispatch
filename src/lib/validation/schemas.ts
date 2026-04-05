// ── Shared Zod Schemas ────────────────────────────────────────────────────────
// Single source of truth for form validation across the booking wizard and
// customer portal. Importable by both src/ (React) and convex/ (server).

import { z } from 'zod'
import { COURSE_CODES } from '@/lib/constants/course-catalog'
import {
  CERT_REQUIRED_ACTIVITIES,
  calcAgeAtDate,
} from '@/lib/constants/activity-rules'

// ── Location ──────────────────────────────────────────────────────────────────
// Re-exported from the canonical definition in schemas/location.ts.

export { locationSchema } from '@/lib/schemas/location'

// ── Primitives ────────────────────────────────────────────────────────────────

const phoneRegex = /^\+?[\d\s\-().]{7,}$/

const phoneField = z
  .string()
  .min(1, 'Required')
  .regex(phoneRegex, 'Use international format: +1 555 000 0000')

const dateField = z.string().min(1, 'Required')

const courseCodes = COURSE_CODES

// ── customerContactSchema ─────────────────────────────────────────────────────
// Base schema for the portal contact step (agency/agencyID are optional by default).
// Use makeCustomerContactSchema() to add activity-type-conditional cert requirements.

const baseCustomerContactSchema = z.object({
  legalFirstName: z.string().min(1, 'Required'),
  legalLastName: z.string().min(1, 'Required'),
  preferredName: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: phoneField,
  dateOfBirth: dateField,
  gender: z.enum(['M', 'F', 'Other']),
  nationality: z.string().min(1, 'Required'),
  passportNumber: z.string().min(1, 'Required'),
  passportIssuingCountry: z.string().min(1, 'Required'),
  passportExpirationDate: dateField,
  emergencyContactName: z.string().min(1, 'Required'),
  emergencyContactPhone: phoneField,
  emergencyContactRelation: z.string().min(1, 'Required'),
  agency: z.string().optional(),
  agencyID: z.string().optional(),
  allergies: z.string().optional(),
})

export type CustomerContactData = z.infer<typeof baseCustomerContactSchema>

/**
 * Returns a customerContactSchema with optional cert-requirement refinement.
 * If activityTypes includes any CERT_REQUIRED_ACTIVITIES entry, agency + agencyID
 * become required fields (validated via superRefine).
 */
export function makeCustomerContactSchema(activityTypes: readonly string[] = []) {
  const needsCert = activityTypes.some((t) =>
    (CERT_REQUIRED_ACTIVITIES as readonly string[]).includes(t),
  )
  if (!needsCert) return baseCustomerContactSchema
  return baseCustomerContactSchema.superRefine((data, ctx) => {
    if (!data.agency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agency'],
        message: 'Certification agency required for this activity',
      })
    }
    if (!data.agencyID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agencyID'],
        message: 'Certification number required for this activity',
      })
    }
  })
}

export const customerContactSchema = baseCustomerContactSchema

// ── medicalAnswersSchema ──────────────────────────────────────────────────────
// All 10 PADI 10346 medical questions must be answered as boolean.

export const medicalAnswersSchema = z.object({
  medical_q1: z.boolean(),
  medical_q2: z.boolean(),
  medical_q3: z.boolean(),
  medical_q4: z.boolean(),
  medical_q5: z.boolean(),
  medical_q6: z.boolean(),
  medical_q7: z.boolean(),
  medical_q8: z.boolean(),
  medical_q9: z.boolean(),
  medical_q10: z.boolean(),
})

export type MedicalAnswersData = z.infer<typeof medicalAnswersSchema>

// ── waiverSchema ──────────────────────────────────────────────────────────────
// Base waiver schema. Use makeWaiverSchema() to add guardian-signature requirement
// for minors (age < 18 at booking startDate).

const baseWaiverSchema = z.object({
  waiverSignedAt: z.number(),
  signatureFileId: z.string().min(1, 'Signature required'),
  guardianSignatureFileId: z.string().optional(),
})

export type WaiverData = z.infer<typeof baseWaiverSchema>

/**
 * Returns a waiverSchema that requires guardianSignatureFileId when the diver
 * is under 18 at the booking startDate.
 */
export function makeWaiverSchema(dateOfBirth?: string, bookingStartDate?: string) {
  return baseWaiverSchema.superRefine((data, ctx) => {
    if (!dateOfBirth || !bookingStartDate) return
    const age = calcAgeAtDate(dateOfBirth, bookingStartDate)
    if (age < 18 && !data.guardianSignatureFileId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guardianSignatureFileId'],
        message: 'Guardian signature required for divers under 18',
      })
    }
  })
}

export const waiverSchema = baseWaiverSchema

// ── equipmentSizingSchema ─────────────────────────────────────────────────────
// Body measurements and rental checklist for the portal equipment step.
// Matches saveEquipmentData split: body measurements → customers, checklist → customerProfiles.

export const equipmentSizingSchema = z.object({
  heightCm: z.number().min(50, 'Must be at least 50 cm').max(300, 'Must be at most 300 cm').optional(),
  weightKg: z.number().min(20, 'Must be at least 20 kg').max(300, 'Must be at most 300 kg').optional(),
  shoeSize: z.number().min(10).max(70).optional(),
  shoeSizeUnit: z.enum(['EU', 'US', 'CM']).optional(),
  needsPoweredLenses: z.boolean().optional(),
  prescriptionStrength: z.string().optional(),
  rentalChecklist: z
    .object({
      mask: z.enum(['own', 'rent']),
      bcd: z.enum(['own', 'rent']),
      wetsuit: z.enum(['own', 'rent']),
      fins: z.enum(['own', 'rent']),
      regulator: z.enum(['own', 'rent']),
      maskPrescription: z.string().optional(),
    })
    .optional(),
})

export type EquipmentSizingData = z.infer<typeof equipmentSizingSchema>

// ── bookingDetailsSchema ──────────────────────────────────────────────────────
// Wizard step 1: booking-level details (activities, dates, portal flags).

export const bookingDetailsSchema = z
  .object({
    activityType: z
      .array(z.enum(courseCodes))
      .min(1, 'At least one activity type is required'),
    startDate: dateField,
    endDate: dateField,
    portalContact: z.boolean(),
    portalMedical: z.boolean(),
    portalWaiver: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date must be on or after start date',
      })
    }
  })

export type BookingDetailsData = z.infer<typeof bookingDetailsSchema>

// ── diverEntrySchema ──────────────────────────────────────────────────────────
// Wizard step 2: individual diver row in the booking wizard.

export const diverEntrySchema = z
  .object({
    name: z.string().min(1, 'Diver name is required'),
    abbrev: z.string().optional(),
    flag: z.object({
      code: z.string(),
      label: z.string(),
    }),
    startDate: dateField,
    endDate: dateField,
    agency: z.string().optional(),
    activityType: z
      .array(z.enum(courseCodes))
      .min(1, 'At least one activity type is required'),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date must be on or after start date',
      })
    }
  })

export type DiverEntryData = z.infer<typeof diverEntrySchema>

// ── profileFieldsSchema ───────────────────────────────────────────────────────
// Operator / user profile update fields (name, business details, locale).

export const profileFieldsSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  nickname: z.string().optional(),
  businessName: z.string().min(1, 'Required'),
  appLanguage: z.string().min(1, 'Required'),
})

export type ProfileFieldsData = z.infer<typeof profileFieldsSchema>
