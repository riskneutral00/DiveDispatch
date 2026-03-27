import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { QueryCtx, MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { resolvePortalToken, resolvePortalTokenSoft } from './lib/portal'
import { sanitizeFields, sanitizePassport, PORTAL_CONTACT_FIELDS } from './lib/sanitize'
import { checkRateLimit } from './lib/rateLimiter'
import { ErrorCode } from './lib/errorCodes'

// ── Returning customer lookup ────────────────────────────────────────────────

/**
 * Checks if a customer with the given email already exists.
 * Returns contact + equipment data for pre-fill (NOT medical/waiver).
 * Requires a valid portal token — no PII without auth.
 * Case-insensitive email match via normalized lowercase index lookup.
 */
export async function _checkReturningCustomerHandler(
  ctx: QueryCtx,
  args: { email: string; token: string },
) {
  // Gate: require valid portal token before returning any PII
  if (!args.token) return null
  const resolved = await resolvePortalTokenSoft(ctx, args.token)
  if (!resolved) return null

  const normalizedEmail = args.email.toLowerCase().trim()

  // Index lookup using normalized email (emails stored lowercase on insert)
  const match = await ctx.db
    .query('customers')
    .withIndex('by_email', (q) => q.eq('email', normalizedEmail))
    .first()

  if (!match) return null

  return {
    _id: match._id,
    legalFirstName: match.legalFirstName,
    legalLastName: match.legalLastName,
    preferredName: match.preferredName,
    email: match.email,
    phone: match.phone,
    dateOfBirth: match.dateOfBirth,
    gender: match.gender,
    nationality: match.nationality,
    passportNumber: match.passportNumber,
    passportIssuingCountry: match.passportIssuingCountry,
    passportExpirationDate: match.passportExpirationDate,
    emergencyContactName: match.emergencyContactName,
    emergencyContactPhone: match.emergencyContactPhone,
    emergencyContactRelation: match.emergencyContactRelation,
    agency: match.agency,
    agencyID: match.agencyID,
    allergies: match.allergies,
    // Equipment sizing
    heightCm: match.heightCm,
    weightKg: match.weightKg,
    shoeSize: match.shoeSize,
    shoeSizeUnit: match.shoeSizeUnit,
    needsPoweredLenses: match.needsPoweredLenses,
    prescriptionStrength: match.prescriptionStrength,
    totalDives: match.totalDives,
    lastDiveDate: match.lastDiveDate,
  }
}

export const checkReturningCustomer = query({
  args: { email: v.string(), token: v.string() },
  handler: _checkReturningCustomerHandler,
})

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Loads portal context for the contact step: booking metadata, activity types,
 * and any previously saved customer data. Returns null if token is invalid/expired.
 */
export const getPortalContext = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const resolved = await resolvePortalTokenSoft(ctx, args.token)
    if (!resolved) return null

    const { link, booking, profile } = resolved

    let customer = null
    if (profile?.customerId) {
      customer = await ctx.db.get(profile.customerId)
    }

    return {
      operatorName: booking.operatorName as string,
      activityType: booking.activityType as string[],
      prefillName: link.customerName as string,
      prefillEmail: link.email as string,
      customer: customer as {
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
      } | null,
    }
  },
})

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Creates or updates the customers record for this portal slot.
 * Auth boundary: BookingLink token (no Clerk required).
 */
export const savePortalContact = mutation({
  args: {
    token: v.string(),
    existingCustomerId: v.optional(v.string()),
    legalFirstName: v.string(),
    legalLastName: v.string(),
    preferredName: v.optional(v.string()),
    email: v.string(),
    phone: v.string(),
    dateOfBirth: v.string(),
    gender: v.union(v.literal('M'), v.literal('F'), v.literal('Other')),
    nationality: v.string(),
    passportNumber: v.string(),
    passportIssuingCountry: v.string(),
    passportExpirationDate: v.string(),
    emergencyContactName: v.string(),
    emergencyContactPhone: v.string(),
    emergencyContactRelation: v.string(),
    agency: v.optional(v.string()),
    agencyID: v.optional(v.string()),
    allergies: v.optional(v.string()),
  },
  handler: _savePortalContactHandler,
})

export async function _savePortalContactHandler(
  ctx: MutationCtx,
  args: {
    token: string
    existingCustomerId?: string
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
  },
): Promise<void> {
  await checkRateLimit(ctx, 'savePortalContact', args.token)
  const { profile } = await resolvePortalToken(ctx, args.token)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { token: _token, existingCustomerId: _existingId, ...rawContactData } = args
  // Sanitize all string fields (trim, strip invisible chars, cap lengths)
  const contactData = sanitizeFields(rawContactData, PORTAL_CONTACT_FIELDS)
  // Passport: strip to alphanumeric + hyphen, uppercase, max 20 chars
  contactData.passportNumber = sanitizePassport(contactData.passportNumber)
  // Normalize email to lowercase for consistent index lookups
  contactData.email = contactData.email.toLowerCase().trim()

  if (profile.customerId) {
    // Already linked — update existing record
    await ctx.db.patch(profile.customerId, contactData)
  } else if (args.existingCustomerId) {
    // Returning customer confirmed — reuse existing record, update with latest data
    const existingId = args.existingCustomerId as Id<'customers'>

    // DD-151: Validate existingCustomerId ownership to prevent IDOR
    const existingCustomer = await ctx.db.get(existingId)
    if (!existingCustomer) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }
    // Verify the customer's email matches the contact data being submitted
    // (the returning-customer flow is triggered by email match in checkReturningCustomer)
    if (existingCustomer.email.toLowerCase() !== contactData.email.toLowerCase()) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    await ctx.db.patch(existingId, contactData)
    await ctx.db.patch(profile._id, { customerId: existingId })
  } else {
    // First-time customer — create new record
    const customerId = await ctx.db.insert('customers', {
      ...contactData,
      createdAt: Date.now(),
    })
    await ctx.db.patch(profile._id, { customerId })
  }
}
