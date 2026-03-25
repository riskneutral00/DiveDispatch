// Shared profile completeness check — used by getOnboardingStatus query,
// createDraftShell mutation, and getAllRolesCompleteness query.

import type { Id } from '../_generated/dataModel'
import { OPERATOR_ROLE_SET as OPERATOR_ROLES } from './auth'

export async function checkProfileCompleteness(
  ctx: { db: any },
  user: { _id: any; slug: string; role: string; defaultContactEmail?: string; defaultContactPhone?: string; defaultLocation?: string },
): Promise<{ percentage: number; incomplete: string[] }> {
  const role = user.role
  const incomplete: string[] = []

  // Fetch role-specific profile record
  let profile: Record<string, unknown> | null = null
  const profileTable = {
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
  } as const

  const table = profileTable[role as keyof typeof profileTable]
  if (table) {
    profile = await ctx.db
      .query(table)
      .withIndex('by_userId', (q: { eq: (f: string, v: unknown) => unknown }) =>
        q.eq('userId', user._id),
      )
      .unique()
  }

  // Core profile fields
  const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0
  const arr = (v: unknown) => Array.isArray(v) && v.length > 0

  if (!str(profile?.name)) incomplete.push('Business name')
  if (role === 'Agent') {
    const locations = profile?.locations as Array<{ placeName: string; country: string }> | undefined
    if (!locations?.[0]?.placeName) incomplete.push('Location')
    if (!locations?.[0]?.country) incomplete.push('Country')
  } else {
    if (!str(profile?.placeName)) incomplete.push('Location')
    if (!str(profile?.country)) incomplete.push('Country')
  }
  if (!str(profile?.contactEmail) && !str(user.defaultContactEmail)) incomplete.push('Contact email')
  if (!str(profile?.contactPhone) && !str(user.defaultContactPhone)) incomplete.push('Contact phone')

  // Role-specific list field
  if (role === 'DiveCenter' || role === 'Agent' || role === 'Liveaboard') {
    if (!arr(profile?.associations)) incomplete.push('Agency associations')
  } else if (role === 'Instructor' || role === 'DiveMaster') {
    if (!arr(profile?.credential)) incomplete.push('Credentials')
  }

  // Quick Book pill (organizers only)
  if (OPERATOR_ROLES.has(role)) {
    const template = await ctx.db
      .query('bookingTemplates')
      .withIndex('by_ownerId_ownerType', (q: any) =>
        q.eq('ownerId', user.slug).eq('ownerType', role),
      )
      .first()
    if (!template) incomplete.push('Quick Book pill')
  }

  // Preferred instructors (organizers only) — uses SLUG not _id
  if (OPERATOR_ROLES.has(role)) {
    const prefs = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q: any) => q.eq('stakeholderId', user.slug))
      .unique()
    if (!prefs?.preferredInstructorSlugs?.length) incomplete.push('Preferred instructors')
  }

  // Calculate total
  const baseCount = 5
  const hasListField = ['DiveCenter', 'Agent', 'Liveaboard', 'Instructor', 'DiveMaster'].includes(role)
  const hasTemplateSlot = OPERATOR_ROLES.has(role)
  const hasPreferredInstructors = OPERATOR_ROLES.has(role)
  const total = baseCount + (hasListField ? 1 : 0) + (hasTemplateSlot ? 1 : 0) + (hasPreferredInstructors ? 1 : 0)
  const filled = total - incomplete.length
  const percentage = Math.round((filled / total) * 100)

  return { percentage, incomplete }
}

/**
 * Checks profile completeness across ALL of a user's roles.
 * Returns allComplete: true only when every role is at 100%.
 * Used by the booking gate and the profile completion banner.
 */
export async function checkAllRolesCompleteness(
  ctx: { db: any },
  userId: Id<'users'>,
): Promise<{
  allComplete: boolean
  roles: Array<{ role: string; percentage: number; incomplete: string[] }>
}> {
  const user = await ctx.db.get(userId)
  if (!user) return { allComplete: true, roles: [] }

  const userRoles = await ctx.db
    .query('userRoles')
    .withIndex('by_userId', (q: any) => q.eq('userId', userId))
    .collect()

  // Fall back to primary role if no userRoles rows exist
  const rolesToCheck = userRoles.length > 0
    ? userRoles.map((r: any) => r.role as string)
    : [user.role as string]

  const roles: Array<{ role: string; percentage: number; incomplete: string[] }> = []
  let allComplete = true

  for (const role of rolesToCheck) {
    const result = await checkProfileCompleteness(ctx, {
      _id: user._id,
      slug: user.slug,
      role,
      defaultContactEmail: user.defaultContactEmail,
      defaultContactPhone: user.defaultContactPhone,
      defaultLocation: user.defaultLocation,
    })
    roles.push({ role, ...result })
    if (result.percentage < 100) allComplete = false
  }

  return { allComplete, roles }
}
