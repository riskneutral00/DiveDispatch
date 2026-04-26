import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { DbCtx } from './lib/auth'
import { resolvePortalToken, resolvePortalTokenSoft } from './lib/portal'
import { sanitizeFields, PORTAL_EQUIPMENT_FIELDS, PORTAL_EQUIPMENT_CHECKLIST_FIELDS } from './lib/sanitize'
import { checkRateLimit } from './lib/rateLimiter'
import { safeDecryptMedical } from './lib/crypto'
import { rentalChecklistValidator } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'

export type ContactData = {
  legalFirstName: string
  legalLastName: string
  preferredName?: string
  email: string
  phone: string
  dateOfBirth: string
  gender: 'M' | 'F' | 'Other'
  nationality: string
  passportNumber: string
  passportIssuingCountry: string
  passportExpirationDate: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelation: string
  agency?: string
  agencyID?: string
  allergies?: string
}

export type MedicalData = {
  answers: Record<string, boolean | string>
  physicianClearanceRequired: boolean
}

export type EquipmentData = {
  heightCm?: number
  weightKg?: number
  shoeSize?: number
  shoeSizeUnit?: string
  needsPoweredLenses?: boolean
  prescriptionStrength?: string
  rentalChecklist?: {
    mask: 'own' | 'rent'
    bcd: 'own' | 'rent'
    wetsuit: 'own' | 'rent'
    fins: 'own' | 'rent'
    regulator: 'own' | 'rent'
    maskPrescription?: string
  }
}

export type PortalStep = 'contact' | 'medical' | 'waiver' | 'equipment' | 'submit'

export type PortalProgress = {
  requiresContact: boolean
  requiresMedical: boolean
  requiresWaiver: boolean

  contactComplete: boolean
  medicalComplete: boolean
  waiverComplete: boolean
  equipmentComplete: boolean

  contactData: ContactData | null
  medicalData: MedicalData | null
  waiverSignedAt: number | null
  equipmentData: EquipmentData | null

  firstIncompleteStep: PortalStep
}

export async function _getPortalProgress(
  ctx: DbCtx,
  args: { token: string },
): Promise<PortalProgress | null> {
  const resolved = await resolvePortalTokenSoft(ctx, args.token)
  if (!resolved) return null

  const { booking, profile } = resolved

  let customer: Record<string, unknown> | null = null
  if (profile.customerId) {
    customer = await ctx.db.get(profile.customerId)
  }

  const contactData: ContactData | null = customer
    ? {
        legalFirstName: customer.legalFirstName as string,
        legalLastName: customer.legalLastName as string,
        preferredName: customer.preferredName as string | undefined,
        email: customer.email as string,
        phone: customer.phone as string,
        dateOfBirth: customer.dateOfBirth as string,
        gender: customer.gender as 'M' | 'F' | 'Other',
        nationality: customer.nationality as string,
        passportNumber: customer.passportNumber as string,
        passportIssuingCountry: customer.passportIssuingCountry as string,
        passportExpirationDate: customer.passportExpirationDate as string,
        emergencyContactName: customer.emergencyContactName as string,
        emergencyContactPhone: customer.emergencyContactPhone as string,
        emergencyContactRelation: customer.emergencyContactRelation as string,
        agency: customer.agency as string | undefined,
        agencyID: customer.agencyID as string | undefined,
        allergies: customer.allergies as string | undefined,
      }
    : null

  const medicalAnswers: Record<string, boolean | string> = profile.medicalAnswers
    ? await safeDecryptMedical(profile.medicalAnswers)
    : {}
  const medicalData: MedicalData | null =
    Object.keys(medicalAnswers).length > 0
      ? {
          answers: medicalAnswers,
          physicianClearanceRequired: profile.physicianClearanceRequired as boolean,
        }
      : null

  const rentalChecklist = profile.rentalChecklist as EquipmentData['rentalChecklist'] | undefined
  let equipmentData: EquipmentData | null = null
  if (customer || rentalChecklist) {
    const ed: EquipmentData = {}
    if (customer) {
      if (customer.heightCm != null) ed.heightCm = customer.heightCm as number
      if (customer.weightKg != null) ed.weightKg = customer.weightKg as number
      if (customer.shoeSize != null) ed.shoeSize = customer.shoeSize as number
      if (customer.shoeSizeUnit != null) ed.shoeSizeUnit = customer.shoeSizeUnit as string
      if (customer.needsPoweredLenses != null)
        ed.needsPoweredLenses = customer.needsPoweredLenses as boolean
      if (customer.prescriptionStrength != null)
        ed.prescriptionStrength = customer.prescriptionStrength as string
    }
    if (rentalChecklist != null) ed.rentalChecklist = rentalChecklist
    if (Object.keys(ed).length > 0) equipmentData = ed
  }

  const contactComplete = profile.customerId != null
  const medicalComplete = medicalData !== null
  const waiverComplete = profile.waiverSignedAt != null
  const equipmentComplete =
    rentalChecklist != null &&
    rentalChecklist.mask != null &&
    rentalChecklist.bcd != null &&
    rentalChecklist.wetsuit != null &&
    rentalChecklist.fins != null &&
    rentalChecklist.regulator != null

  const requiresContact = booking.portalContact as boolean
  const requiresMedical = booking.portalMedical as boolean
  const requiresWaiver = booking.portalWaiver as boolean

  let firstIncompleteStep: PortalStep = 'submit'
  if (requiresWaiver && !waiverComplete) firstIncompleteStep = 'waiver'
  if (requiresMedical && !medicalComplete) firstIncompleteStep = 'medical'
  if (requiresContact && !contactComplete) firstIncompleteStep = 'contact'

  return {
    requiresContact,
    requiresMedical,
    requiresWaiver,
    contactComplete,
    medicalComplete,
    waiverComplete,
    equipmentComplete,
    contactData,
    medicalData,
    waiverSignedAt: (profile.waiverSignedAt as number | undefined) ?? null,
    equipmentData,
    firstIncompleteStep,
  }
}

export const getPortalProgress = query({
  args: { token: v.string() },
  handler: _getPortalProgress,
})

export const saveEquipmentData = mutation({
  args: {
    token: v.string(),
    heightCm: v.optional(v.number()),
    weightKg: v.optional(v.number()),
    shoeSize: v.optional(v.number()),
    shoeSizeUnit: v.optional(v.union(v.literal('EU'), v.literal('US'), v.literal('CM'))),
    needsPoweredLenses: v.optional(v.boolean()),
    prescriptionStrength: v.optional(v.string()),
    rentalChecklist: v.optional(rentalChecklistValidator),
  },
  handler: async (ctx, args): Promise<void> => {
    await checkRateLimit(ctx, 'saveEquipmentData', args.token)
    const { profile } = await resolvePortalToken(ctx, args.token)
    const sanitized = sanitizeFields(args, PORTAL_EQUIPMENT_FIELDS)

    if (args.heightCm !== undefined && (args.heightCm < 50 || args.heightCm > 250)) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'heightCm must be between 50 and 250' })
    }
    if (args.weightKg !== undefined && (args.weightKg < 15 || args.weightKg > 300)) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'weightKg must be between 15 and 300' })
    }
    if (args.shoeSize !== undefined && (args.shoeSize < 15 || args.shoeSize > 55)) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'shoeSize must be between 15 and 55' })
    }

    if (args.rentalChecklist !== undefined) {
      const { mask, bcd, wetsuit, fins, regulator } = args.rentalChecklist
      const hasAnyRental = [mask, bcd, wetsuit, fins, regulator].includes('rent')

      if (hasAnyRental) {
        if (args.heightCm === undefined) {
          throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'heightCm is required when renting equipment' })
        }
        if (args.weightKg === undefined) {
          throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'weightKg is required when renting equipment' })
        }
      }

      if (fins === 'rent' && args.shoeSize === undefined) {
        throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'shoeSize is required when renting fins' })
      }

      if (mask === 'rent' && args.needsPoweredLenses === true && !args.prescriptionStrength?.trim()) {
        throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'prescriptionStrength is required when renting mask with powered lenses' })
      }
    }

    if (profile.customerId) {
      const customerPatch: Record<string, unknown> = {}
      if (args.heightCm !== undefined) customerPatch.heightCm = args.heightCm
      if (args.weightKg !== undefined) customerPatch.weightKg = args.weightKg
      if (args.shoeSize !== undefined) customerPatch.shoeSize = args.shoeSize
      if (args.shoeSizeUnit !== undefined) customerPatch.shoeSizeUnit = args.shoeSizeUnit
      if (args.needsPoweredLenses !== undefined)
        customerPatch.needsPoweredLenses = args.needsPoweredLenses
      if (sanitized.prescriptionStrength !== undefined)
        customerPatch.prescriptionStrength = sanitized.prescriptionStrength
      if (Object.keys(customerPatch).length > 0) {
        await ctx.db.patch(profile.customerId, customerPatch)
      }
    }

    if (args.rentalChecklist !== undefined) {
      const sanitizedChecklist = sanitizeFields(args.rentalChecklist, PORTAL_EQUIPMENT_CHECKLIST_FIELDS)
      await ctx.db.patch(profile._id, { rentalChecklist: sanitizedChecklist })
    }
  },
})
