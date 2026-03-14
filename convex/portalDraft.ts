import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = any

// ── Types ─────────────────────────────────────────────────────────────────────

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
  // Which steps this booking requires
  requiresContact: boolean
  requiresMedical: boolean
  requiresWaiver: boolean

  // Completion status per step
  contactComplete: boolean
  medicalComplete: boolean
  waiverComplete: boolean
  equipmentComplete: boolean

  // Saved data for pre-filling each step on resume
  contactData: ContactData | null
  medicalData: MedicalData | null
  waiverSignedAt: number | null
  equipmentData: EquipmentData | null

  // First step the customer should land on when loading the portal
  firstIncompleteStep: PortalStep
}

// ── Token validation helper ───────────────────────────────────────────────────

async function resolveTokenForPortal(ctx: AnyCtx, token: string) {
  const link = await ctx.db
    .query('bookingLinks')
    .withIndex('by_token', (q: AnyCtx) => q.eq('token', token))
    .unique()
  if (!link) throw new ConvexError({ code: 'TOKEN_EXPIRED' })
  if ((link.expiresAt as number) < Date.now()) throw new ConvexError({ code: 'TOKEN_EXPIRED' })

  const booking = await ctx.db.get(link.bookingId)
  if (!booking) throw new ConvexError({ code: 'NOT_FOUND' })
  if (booking.status !== 'Draft') throw new ConvexError({ code: 'BOOKING_CLOSED' })

  const profile = await ctx.db
    .query('customerProfiles')
    .withIndex('by_linkToken', (q: AnyCtx) => q.eq('linkToken', token))
    .unique()
  if (!profile) throw new ConvexError({ code: 'NOT_FOUND' })

  return { link, booking, profile }
}

// ── getPortalProgress handler (exported for unit testing) ────────────────────

/**
 * Returns the full portal progress for a given token.
 * Used by the portal root on mount to pre-fill steps and auto-advance past
 * completed steps. Returns null if token is invalid, expired, or booking is
 * no longer Draft.
 *
 * Auth: token IS the credential (no Clerk auth).
 */
export async function _getPortalProgress(
  ctx: AnyCtx,
  args: { token: string },
): Promise<PortalProgress | null> {
  const link = await ctx.db
    .query('bookingLinks')
    .withIndex('by_token', (q: AnyCtx) => q.eq('token', args.token))
    .unique()

  if (!link) return null
  if ((link.expiresAt as number) < Date.now()) return null

  const booking = await ctx.db.get(link.bookingId)
  if (!booking) return null
  if (booking.status !== 'Draft') return null

  const profile = await ctx.db
    .query('customerProfiles')
    .withIndex('by_linkToken', (q: AnyCtx) => q.eq('linkToken', args.token))
    .unique()

  if (!profile) return null

  // Load customer record for contact + equipment body measurement data
  let customer: Record<string, unknown> | null = null
  if (profile.customerId) {
    customer = await ctx.db.get(profile.customerId)
  }

  // Build contact data from customer record
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

  // Build medical data from profile
  const medicalAnswers = (profile.medicalAnswers ?? {}) as Record<string, boolean | string>
  const medicalData: MedicalData | null =
    Object.keys(medicalAnswers).length > 0
      ? {
          answers: medicalAnswers,
          physicianClearanceRequired: profile.physicianClearanceRequired as boolean,
        }
      : null

  // Build equipment data from customer body measurements + profile rentalChecklist
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

  // Completion flags
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

  // Determine first incomplete required step (evaluate in reverse priority order)
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

// ── Convex query ──────────────────────────────────────────────────────────────

/**
 * Returns portal form progress for a given booking link token.
 * The frontend uses this on mount to pre-fill each step and skip completed ones.
 * Returns null if token is invalid, expired, or booking is no longer Draft.
 */
export const getPortalProgress = query({
  args: { token: v.string() },
  handler: _getPortalProgress,
})

// ── saveWaiver ────────────────────────────────────────────────────────────────

/**
 * Records that the customer has signed the liability waiver.
 * Persists waiverSignedAt on customerProfiles and optionally saves
 * an insurance policy number. Allows re-signing — overwrites the timestamp.
 *
 * Auth: token IS the credential (no Clerk auth).
 */
export const saveWaiver = mutation({
  args: {
    token: v.string(),
    insurancePolicyNumber: v.optional(v.string()),
  },
  handler: async (
    ctx: AnyCtx,
    args: { token: string; insurancePolicyNumber?: string },
  ): Promise<void> => {
    const { profile } = await resolveTokenForPortal(ctx, args.token)

    const patch: Record<string, unknown> = {
      waiverSignedAt: Date.now(),
    }
    if (args.insurancePolicyNumber !== undefined) {
      patch.insurancePolicyNumber = args.insurancePolicyNumber
    }

    await ctx.db.patch(profile._id, patch)
  },
})

// ── saveEquipmentData ─────────────────────────────────────────────────────────

/**
 * Persists equipment sizing and rental choices entered in the equipment step.
 * Body measurements (height, weight, shoe size, lenses) are stored on the
 * customers record. The rental checklist is stored on customerProfiles.
 *
 * Requires that the contact step has been completed (profile.customerId set),
 * otherwise body measurements cannot be attached to a customer record.
 * rentalChecklist can be saved independently of body measurements.
 *
 * Auth: token IS the credential (no Clerk auth).
 */
export const saveEquipmentData = mutation({
  args: {
    token: v.string(),
    heightCm: v.optional(v.number()),
    weightKg: v.optional(v.number()),
    shoeSize: v.optional(v.number()),
    shoeSizeUnit: v.optional(v.union(v.literal('EU'), v.literal('US'), v.literal('CM'))),
    needsPoweredLenses: v.optional(v.boolean()),
    prescriptionStrength: v.optional(v.string()),
    rentalChecklist: v.optional(
      v.object({
        mask: v.union(v.literal('own'), v.literal('rent')),
        bcd: v.union(v.literal('own'), v.literal('rent')),
        wetsuit: v.union(v.literal('own'), v.literal('rent')),
        fins: v.union(v.literal('own'), v.literal('rent')),
        regulator: v.union(v.literal('own'), v.literal('rent')),
        maskPrescription: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx: AnyCtx, args: AnyCtx): Promise<void> => {
    const { profile } = await resolveTokenForPortal(ctx, args.token)

    // Save body measurements to customers record if contact step is complete
    if (profile.customerId) {
      const customerPatch: Record<string, unknown> = {}
      if (args.heightCm !== undefined) customerPatch.heightCm = args.heightCm
      if (args.weightKg !== undefined) customerPatch.weightKg = args.weightKg
      if (args.shoeSize !== undefined) customerPatch.shoeSize = args.shoeSize
      if (args.shoeSizeUnit !== undefined) customerPatch.shoeSizeUnit = args.shoeSizeUnit
      if (args.needsPoweredLenses !== undefined)
        customerPatch.needsPoweredLenses = args.needsPoweredLenses
      if (args.prescriptionStrength !== undefined)
        customerPatch.prescriptionStrength = args.prescriptionStrength
      if (Object.keys(customerPatch).length > 0) {
        await ctx.db.patch(profile.customerId, customerPatch)
      }
    }

    // Save rentalChecklist to customerProfiles
    if (args.rentalChecklist !== undefined) {
      await ctx.db.patch(profile._id, { rentalChecklist: args.rentalChecklist })
    }
  },
})
