import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { type AnyCtx } from './lib/auth'
import { resolvePortalToken, resolvePortalTokenSoft } from './lib/portal'

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Loads portal context for the contact step: booking metadata, activity types,
 * and any previously saved customer data. Returns null if token is invalid/expired.
 */
export const getPortalContext = query({
  args: { token: v.string() },
  handler: async (ctx: AnyCtx, args: { token: string }) => {
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
  handler: async (ctx: AnyCtx, args: AnyCtx): Promise<void> => {
    const { profile } = await resolvePortalToken(ctx, args.token)

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { token: _token, ...contactData } = args

    if (profile.customerId) {
      await ctx.db.patch(profile.customerId, contactData)
    } else {
      const customerId = await ctx.db.insert('customers', {
        ...contactData,
        createdAt: Date.now(),
      })
      await ctx.db.patch(profile._id, { customerId })
    }
  },
})
