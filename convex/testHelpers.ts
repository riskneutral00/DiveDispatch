import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { tryAutoAdvance } from './bookings/_shared'
import { BOOKING_STATUS } from './shared/statuses'

/**
 * DEV-ONLY: Delete a Convex user record by email.
 * Used by E2E tests to clear the webhook-created user so the account page
 * shows the setup wizard (role selection tiles) instead of EditProfileForm.
 */
export const deleteUserByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .unique()
    if (!user) return { deleted: false }
    await ctx.db.delete(user._id)
    return { deleted: true }
  },
})

/**
 * DEV-ONLY: Set customerFormComplete on the most recent Draft booking for an owner
 * and trigger auto-advance. Used by E2E tests to simulate portal completion.
 */
export const completeCustomerForm = internalMutation({
  args: { ownerSlug: v.string() },
  handler: async (ctx, args) => {
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_ownerId_ownerType', (q: any) => q.eq('ownerId', args.ownerSlug))
      .collect() // bounded: test fixture
    const draft = bookings
      .filter((b) => b.status === BOOKING_STATUS.Draft && b.bookingFormComplete)
      .sort((a, b) => b.createdAt - a.createdAt)[0]
    if (!draft) return { ok: false, reason: 'no submitted draft found' }
    await ctx.db.patch(draft._id, { customerFormComplete: true })
    await tryAutoAdvance(ctx, draft._id as string)
    return { ok: true, bookingId: draft._id }
  },
})
