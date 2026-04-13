import { z } from 'zod'
import { COURSE_CODES } from '@/lib/constants/course-catalog'
import {
  CERT_REQUIRED_ACTIVITIES,
  calcAgeAtDate,
} from '@/lib/constants/activity-rules'

export { locationSchema } from '@/lib/schemas/location'

function requireEndAfterStart(
  data: { startDate?: string; endDate?: string },
  ctx: z.RefinementCtx,
) {
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'End date must be on or after start date',
    })
  }
}

const phoneRegex = /^\+?[\d\s\-().]{7,}$/

const phoneField = z
  .string()
  .min(1, 'Required')
  .regex(phoneRegex, 'Use international format: +1 202 555 0100')

const dateField = z.string().min(1, 'Required')

const courseCodes = COURSE_CODES

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

const baseWaiverSchema = z.object({
  waiverSignedAt: z.number(),
  signatureFileId: z.string().min(1, 'Signature required'),
  guardianSignatureFileId: z.string().optional(),
})

export type WaiverData = z.infer<typeof baseWaiverSchema>

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
  .superRefine(requireEndAfterStart)

export type BookingDetailsData = z.infer<typeof bookingDetailsSchema>

export const diverEntryBaseSchema = z.object({
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

export const diverEntrySchema = diverEntryBaseSchema
  .superRefine(requireEndAfterStart)

export type DiverEntryData = z.infer<typeof diverEntrySchema>

const sessionEntrySchema = z
  .object({
    inventoryUnitId: z.string().min(1, 'Inventory unit required'),
    date: z.string().min(1, 'Date required'),
    startTime: z.string().min(1, 'Start time required'),
    endTime: z.string().min(1, 'End time required'),
    timezone: z.string().min(1, 'Timezone required'),
    unitsRequested: z.number().int().min(1, 'Units must be at least 1'),
    deliveryLocation: z.enum(['BoatPier', 'Pool', 'Beach']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'End time must be after start time',
      })
    }
  })

export const bookingSessionsSchema = z
  .array(sessionEntrySchema)
  .min(1, 'At least one session is required')
  .superRefine((sessions, ctx) => {
    const seen = new Set<string>()
    sessions.forEach((s, i) => {
      const key = `${s.inventoryUnitId}|${s.date}|${s.startTime}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 'startTime'],
          message: 'Duplicate session: same unit, date, and start time',
        })
      } else {
        seen.add(key)
      }
    })
  })

export type BookingSessionsData = z.infer<typeof bookingSessionsSchema>

export function makeBookingDiversSchema(
  bookingActivityTypes: readonly string[],
  bookingStartDate: string,
  bookingEndDate: string,
) {
  const diverSchema = diverEntryBaseSchema
    .extend({
      abbrev: z
        .string()
        .min(1, 'Abbreviation required')
        .max(4, 'Abbreviation must be at most 4 characters'),
      flag: z.object({
        code: z.string().min(1, 'Nationality required'),
        label: z.string(),
      }),
    })
    .superRefine((data, ctx) => {
      requireEndAfterStart(data, ctx)
      if (data.startDate && bookingStartDate && data.startDate < bookingStartDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['startDate'],
          message: 'Diver start date cannot be before booking start date',
        })
      }
      if (data.endDate && bookingEndDate && data.endDate > bookingEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'Diver end date cannot be after booking end date',
        })
      }
      const invalid = data.activityType.filter(
        (code) => !bookingActivityTypes.includes(code),
      )
      if (invalid.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['activityType'],
          message: `Activity '${invalid[0]}' is not in the booking's selected activity types`,
        })
      }
    })

  return z.array(diverSchema).min(1, 'At least one diver is required')
}

export type BookingDiversData = z.infer<ReturnType<typeof makeBookingDiversSchema>>
