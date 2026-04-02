// Config-driven profile completeness check — used by getProfileCompletionForRole query,
// getOnboardingStatus query, createDraftShell mutation, and profile completion banner.

import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { PROFILE_REQUIRED, SETTINGS_REQUIRED, ROLE_REQUIRED } from './requiredFields'

const profileTable: Record<string, string> = {
  DiveCenter: 'diveCenters',
  Agent: 'agents',
  Instructor: 'instructors',
  DiveMaster: 'diveMasters',
  Boat: 'boats',
  Equipment: 'equipment',
  Pool: 'venues',
  Compressor: 'compressors',
  Liveaboard: 'liveaboards',
  DiveResort: 'diveResorts',
  DiveHostel: 'diveHostels',
  DiveSite: 'venues',
}

/**
 * Check completeness for a single role. Three layers:
 * 1. Profile layer: PROFILE_REQUIRED fields on users table
 * 2. User account fields (users table): SETTINGS_REQUIRED — app language and similar
 * 3. Role profile layer: ROLE_REQUIRED[role] fields on role-specific profile table
 */
export async function checkProfileCompleteness(
  ctx: Pick<QueryCtx, 'db'>,
  user: { _id: Id<'users'> },
  role: string,
): Promise<{ percentage: number; incomplete: string[] }> {
  const incomplete: string[] = []
  const userDoc = await ctx.db.get(user._id)
  if (!userDoc) return { percentage: 0, incomplete: ['User not found'] }

  const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0
  const arr = (v: unknown) => Array.isArray(v) && v.length > 0

  // Deep validators — check required inner fields on array-of-object entries
  const isDiveMasterCredentialDeepValid = (entries: unknown[]) =>
    entries.every((e) => {
      const c = e as Record<string, unknown>
      return str(c.agency) && str(c.level) && str(c.agencyID)
    })
  /** Instructor credentials must include at least one course code per row (schema + forms). */
  const isInstructorCredentialDeepValid = (entries: unknown[]) =>
    entries.every((e) => {
      const c = e as Record<string, unknown>
      const courses = c.courses
      if (!Array.isArray(courses) || courses.length === 0) return false
      if (!courses.every((x) => typeof x === 'string' && str(x))) return false
      return str(c.agency) && str(c.level) && str(c.agencyID)
    })
  const isAssociationDeepValid = (entries: unknown[]) =>
    entries.every((e) => {
      const a = e as Record<string, unknown>
      return str(a.agency) && str(a.number)
    })
  const isFleetDeepValid = (entries: unknown[]) =>
    entries.every((e) => {
      const f = e as Record<string, unknown>
      const maxPax = f.maxPax
      return (
        str(f.boatName) &&
        typeof maxPax === 'number' &&
        Number.isFinite(maxPax) &&
        maxPax >= 1
      )
    })

  // 1. Profile layer
  for (const field of PROFILE_REQUIRED) {
    const value = (userDoc as Record<string, unknown>)[field]
    if (!str(value)) incomplete.push(field)
  }

  // 2. Settings layer
  for (const field of SETTINGS_REQUIRED) {
    const value = (userDoc as Record<string, unknown>)[field]
    if (!str(value)) incomplete.push(field)
  }

  // 3. Role layer
  const table = profileTable[role]
  let profile: Record<string, unknown> | null = null
  if (table) {
    profile = await ctx.db
      .query(table as 'diveCenters')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
  }

  const roleFields = ROLE_REQUIRED[role] ?? []
  for (const field of roleFields) {
    if (!profile) {
      incomplete.push(field)
      continue
    }

    // Agent: customer languages live on users.customerLanguages (not agents table)
    if (role === 'Agent' && field === 'customerLanguages') {
      if (!arr(userDoc.customerLanguages)) incomplete.push(field)
      continue
    }

    // Agent profile uses flat placeName / country on agents row
    if (role === 'Agent' && field === 'placeName') {
      if (!str(profile.placeName)) incomplete.push(field)
      continue
    }
    if (role === 'Agent' && field === 'country') {
      if (!str(profile.country)) incomplete.push(field)
      continue
    }

    // Boat uses fleet for 'diveSite' — check if any fleet entry has routes with diveSite
    if (role === 'Boat' && field === 'diveSite') {
      const fleet = profile.fleet as Array<{ routes?: Array<{ diveSite: string }> }> | undefined
      const hasDiveSite = fleet?.some(f => f.routes?.some(r => r.diveSite))
      if (!hasDiveSite) incomplete.push(field)
      continue
    }

    const value = profile[field]
    if (Array.isArray(value)) {
      if (!arr(value)) {
        incomplete.push(field)
      } else if (field === 'credential') {
        if (role === 'Instructor' && !isInstructorCredentialDeepValid(value)) {
          incomplete.push(field)
        } else if (role === 'DiveMaster' && !isDiveMasterCredentialDeepValid(value)) {
          incomplete.push(field)
        }
      } else if (field === 'associations' && !isAssociationDeepValid(value)) {
        incomplete.push(field)
      } else if (field === 'fleet' && !isFleetDeepValid(value)) {
        incomplete.push(field)
      }
    } else {
      if (!str(value)) incomplete.push(field)
    }
  }

  const total = PROFILE_REQUIRED.length + SETTINGS_REQUIRED.length + roleFields.length
  const filled = total - incomplete.length
  const percentage = total === 0 ? 100 : Math.round((filled / total) * 100)

  return { percentage, incomplete }
}

/**
 * Checks profile completeness across ALL of a user's roles.
 * Returns allComplete: true only when every role is at 100%.
 */
export async function checkAllRolesCompleteness(
  ctx: Pick<QueryCtx, 'db'>,
  userId: Id<'users'>,
): Promise<{
  allComplete: boolean
  roles: Array<{ role: string; percentage: number; incomplete: string[] }>
}> {
  const user = await ctx.db.get(userId)
  if (!user) return { allComplete: true, roles: [] }

  const userRoles = await ctx.db
    .query('userRoles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()

  const rolesToCheck = userRoles.map((r) => r.role)

  const roles: Array<{ role: string; percentage: number; incomplete: string[] }> = []
  let allComplete = true

  for (const role of rolesToCheck) {
    const result = await checkProfileCompleteness(ctx, { _id: user._id }, role)
    roles.push({ role, ...result })
    if (result.percentage < 100) allComplete = false
  }

  return { allComplete, roles }
}
