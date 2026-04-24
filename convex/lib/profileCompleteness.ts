import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { PROFILE_REQUIRED, SETTINGS_REQUIRED } from './requiredFields'
import { ROLE_TABLE_MAP } from './profileHelpers'
import { ROLE_SPECS } from './completeness/roleSpecs'
import { resolveRoleProfile } from './completeness/resolveProfile'
import { str } from './completeness/types'

export type CompletenessKind = 'not_started' | 'partial' | 'complete'

export async function checkProfileCompleteness(
  ctx: QueryCtx,
  user: { _id: Id<'users'> },
  role: string,
): Promise<{ percentage: number; incomplete: string[]; kind: CompletenessKind }> {
  const userDoc = await ctx.db.get(user._id)
  if (!userDoc) return { percentage: 0, incomplete: ['User not found'], kind: 'not_started' }

  const incomplete: string[] = []

  for (const field of PROFILE_REQUIRED) {
    if (!str((userDoc as Record<string, unknown>)[field])) incomplete.push(field)
  }

  for (const field of SETTINGS_REQUIRED) {
    if (!str((userDoc as Record<string, unknown>)[field])) incomplete.push(field)
  }

  const { profile, activeOrgId } = await resolveRoleProfile(ctx, userDoc, role)

  let roleSlots = 0
  for (const evaluator of ROLE_SPECS[role] ?? []) {
    const { slots, incomplete: inc } = await evaluator({
      ctx,
      userDoc,
      profile,
      role,
      activeOrgId,
    })
    roleSlots += slots
    for (const label of inc) incomplete.push(label)
  }

  const total = PROFILE_REQUIRED.length + SETTINGS_REQUIRED.length + roleSlots
  const filled = Math.max(0, total - incomplete.length)
  const percentage = total === 0 ? 100 : Math.round((filled / total) * 100)

  const kind: CompletenessKind =
    ROLE_TABLE_MAP[role] && profile == null ? 'not_started' :
    percentage === 100 ? 'complete' :
    'partial'

  return { percentage, incomplete, kind }
}

export async function checkAllRolesCompleteness(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<{
  allComplete: boolean
  roles: Array<{ role: string; percentage: number; incomplete: string[]; kind: CompletenessKind }>
}> {
  const user = await ctx.db.get(userId)
  if (!user) return { allComplete: true, roles: [] }

  const userRoles = await ctx.db
    .query('userRoles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect() // bounded: per-user roles, max ~12

  const results = await Promise.all(
    userRoles.map((r) => checkProfileCompleteness(ctx, { _id: user._id }, r.role)),
  )
  const roles = userRoles.map((r, i) => ({ role: r.role, ...results[i] }))
  const allComplete = results.every((r) => r.percentage === 100)

  return { allComplete, roles }
}
