import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { QueryCtx, MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { resolvePortalToken, resolvePortalTokenSoft } from './lib/portal'
import { sanitizeFields, sanitizePassport, PORTAL_CONTACT_FIELDS } from './lib/sanitize'
import { checkRateLimit } from './lib/rateLimiter'
import { ErrorCode } from './lib/errorCodes'

export async function _checkReturningCustomerHandler(
  ctx: QueryCtx,
  args: { email: string; token: string },
) {
  if (!args.token) return null
  const resolved = await resolvePortalTokenSoft(ctx, args.token)
  if (!resolved) return null

  const normalizedEmail = args.email.toLowerCase().trim()

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
    heightCm: match.heightCm,
    weightKg: match.weightKg,
    shoeSize: match.shoeSize,
    shoeSizeUnit: match.shoeSizeUnit,
    needsPoweredLenses: match.needsPoweredLenses,
    prescriptionStrength: match.prescriptionStrength,
    totalDives: match.totalDives,
    lastDiveDate: match.lastDiveDate,
    languages: match.languages ?? [],
  }
}

export const checkReturningCustomer = query({
  args: { email: v.string(), token: v.string() },
  handler: _checkReturningCustomerHandler,
})

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
        languages?: string[]
      } | null,
    }
  },
})

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
    languages: v.array(v.string()),
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
    languages: string[]
  },
): Promise<void> {
  await checkRateLimit(ctx, 'savePortalContact', args.token)
  const { profile } = await resolvePortalToken(ctx, args.token)

  if (args.languages.length === 0) {
    throw new ConvexError({ code: ErrorCode.INVALID_INPUT, reason: 'At least one language required' })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- comments-ok
  const { token: _token, existingCustomerId: _existingId, ...rawContactData } = args
  const contactData = sanitizeFields(rawContactData, PORTAL_CONTACT_FIELDS)
  contactData.passportNumber = sanitizePassport(contactData.passportNumber)
  contactData.email = contactData.email.toLowerCase().trim()

  if (profile.customerId) {
    await ctx.db.patch(profile.customerId, contactData)
  } else if (args.existingCustomerId) {
    const existingId = args.existingCustomerId as Id<'customers'>

    const existingCustomer = await ctx.db.get(existingId)
    if (!existingCustomer) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }
    if (existingCustomer.email.toLowerCase() !== contactData.email.toLowerCase()) {
      throw new ConvexError({ code: ErrorCode.FORBIDDEN })
    }

    await ctx.db.patch(existingId, contactData)
    await ctx.db.patch(profile._id, { customerId: existingId })
  } else {
    const customerId = await ctx.db.insert('customers', {
      ...contactData,
      createdAt: Date.now(),
    })
    await ctx.db.patch(profile._id, { customerId })
  }
}
