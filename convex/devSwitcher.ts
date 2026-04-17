import { mutation, query } from './_generated/server'
import type { GenericMutationCtx } from 'convex/server'
import { v, ConvexError } from 'convex/values'
import type { DataModel } from './_generated/dataModel'
import { requireDevSwitchEnabled } from './lib/devGuard'
import { ErrorCode } from './lib/errorCodes'
import { deriveDefaultRole } from './lib/rolePrecedence'
import { getAllUserRoles } from './lib/userRoleHelpers'

type MutCtx = GenericMutationCtx<DataModel>

async function devSwitchUserHandler(ctx: MutCtx, targetSlug: string) {
  requireDevSwitchEnabled()

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

  const targetRoles = await getAllUserRoles(ctx, target._id)
  if (targetRoles.length === 0) {
    throw new ConvexError({ code: ErrorCode.NOT_FOUND, reason: 'Target user has no roles' })
  }
  const defaultRole = deriveDefaultRole(targetRoles.map((r) => r.role))

  if (currentHolder && currentHolder._id === target._id) {
    return { slug: target.slug, role: defaultRole, name: target.name }
  }

  if (currentHolder) {
    const restoreToken = currentHolder.originalTokenIdentifier ?? currentHolder.tokenIdentifier
    const parkedToken =
      restoreToken === realToken
        ? `parked|${currentHolder.slug}|${Date.now()}`
        : restoreToken
    const patch: { tokenIdentifier: string; originalTokenIdentifier?: string } = {
      tokenIdentifier: parkedToken,
    }
    if (!currentHolder.originalTokenIdentifier) {
      patch.originalTokenIdentifier = realToken
    }
    await ctx.db.patch(currentHolder._id, patch)
  }

  const targetPatch: { tokenIdentifier: string; originalTokenIdentifier?: string } = {
    tokenIdentifier: realToken,
  }
  if (!target.originalTokenIdentifier) {
    targetPatch.originalTokenIdentifier = target.tokenIdentifier
  }
  await ctx.db.patch(target._id, targetPatch)

  return { slug: target.slug, role: defaultRole, name: target.name }
}

export const devSwitchUser = mutation({
  args: { targetSlug: v.string() },
  handler: async (ctx, { targetSlug }) => devSwitchUserHandler(ctx, targetSlug),
})

export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    requireDevSwitchEnabled()

    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: ErrorCode.UNAUTHENTICATED })

    const users = await ctx.db.query('users').collect() // bounded: dev-only switcher
    const rolesByUser = await Promise.all(
      users.map((u) => getAllUserRoles(ctx, u._id)),
    )

    return users.flatMap((u, i) => {
      const userRoles = rolesByUser[i]
      if (userRoles.length === 0) return []
      return [
        {
          slug: u.slug,
          firstName: u.firstName,
          lastName: u.lastName,
          name: u.name,
          roles: userRoles.map((r) => r.role),
        },
      ]
    })
  },
})
