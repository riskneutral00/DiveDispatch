import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { resolvePortalToken, resolvePortalTokenSoft } from './lib/portal'

// ── Returning customer lookup ────────────────────────────────────────────────

/**
 * Checks if a customer with the given email already exists.
 * Returns contact + equipment data for pre-fill (NOT medical/waiver).
 * Case-insensitive email match.
 */
export async function _checkReturningCustomerHandler(
  ctx: QueryCtx,
  args: { email: string },
) {
  const normalizedEmail = args.email.toLowerCase().trim()

  // by_email index stores as-entered; scan and compare lowercase
  const allByEmail = await ctx.db
    .query('customers')
    .withIndex('by_email', (q) => q.eq('email', args.email))
    .collect()

  // Also try lowercase match across all if exact didn't work
  let match: (typeof allByEmail)[number] | null = allByEmail[0] ?? null
  if (!match) {
    // Fallback: scan for case-insensitive match
    const recent = await ctx.db.query('customers').order('desc').take(500)
    match = recent.find((c) => c.email.toLowerCase() === normalizedEmail) ?? null
  }

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
  args: { email: v.string() },
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
  ctx: Parameters<typeof resolvePortalToken>[0] & { db: { patch: Function; insert: Function } },
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
  const { profile } = await resolvePortalToken(ctx, args.token)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { token: _token, existingCustomerId: _existingId, ...contactData } = args

  if (profile.customerId) {
    // Already linked — update existing record
    await ctx.db.patch(profile.customerId, contactData)
  } else if (args.existingCustomerId) {
    // Returning customer confirmed — reuse existing record, update with latest data
    const existingId = args.existingCustomerId as Id<'customers'>
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
