import { mutation } from './_generated/server'
import type { GenericMutationCtx } from 'convex/server'
import { v, ConvexError } from 'convex/values'
import type { DataModel } from './_generated/dataModel'
import { ErrorCode } from './lib/errorCodes'
import { deriveDefaultRole } from './lib/rolePrecedence'

type MutCtx = GenericMutationCtx<DataModel>

async function devSwitchUserHandler(ctx: MutCtx, targetSlug: string) {
  if (process.env.DEV_MODE !== 'true') {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'Dev-only endpoint' })
  }

  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

  const realToken = identity.tokenIdentifier

  const currentHolder = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', realToken))
    .first()

  const target = await ctx.db
    .query('users')
    .withIndex('by_slug', (q) => q.eq('slug', targetSlug))
    .first()

  if (!target) throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'Target user not found' })
  if (!target.isSeeded) {
    throw new ConvexError({ code: ErrorCode.FORBIDDEN, reason: 'Can only switch to seed users' })
  }

  // Compute default role from userRoles + precedence
  const targetRoles = await ctx.db
    .query('userRoles')
    .withIndex('by_userId', (q) => q.eq('userId', target._id))
    .collect()
  if (targetRoles.length === 0) {
    throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'Target user has no roles' })
  }
  const defaultRole = deriveDefaultRole(targetRoles.map((r) => r.role))

  // No-op if already this user
  if (currentHolder && currentHolder._id === target._id) {
    return { slug: target.slug, role: defaultRole, name: target.name }
  }

  // Return departed user's token to a stable seed placeholder
  if (currentHolder) {
    await ctx.db.patch(currentHolder._id, { tokenIdentifier: `seed|${currentHolder.slug}` })
  }

  // Assign real Clerk token to target
  await ctx.db.patch(target._id, { tokenIdentifier: realToken })

  return { slug: target.slug, role: defaultRole, name: target.name }
}

export const devSwitchUser = mutation({
  args: { targetSlug: v.string() },
  handler: async (ctx, { targetSlug }) => devSwitchUserHandler(ctx, targetSlug),
})
