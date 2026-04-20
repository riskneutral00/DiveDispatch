import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { PROFILE_REQUIRED, SETTINGS_REQUIRED, ROLE_REQUIRED } from './requiredFields'
import { OPERATOR_ROLE_SET } from './auth'
import { profileBySlug } from './profileHelpers'
import { ROLE_TABLE_MAP } from './profileHelpers'
import { tryGetActiveOrg } from './activeOrg'
import { AOW_REQUIRED_SPECIALTY_COUNT } from '../shared/agencies'
import { evaluateGearInventoryCompleteness } from './equipmentGearCompleteness'

export type CompletenessKind = 'not_started' | 'partial' | 'complete'

export async function checkProfileCompleteness(
  ctx: QueryCtx,
  user: { _id: Id<'users'> },
  role: string,
): Promise<{ percentage: number; incomplete: string[]; kind: CompletenessKind }> {
  const incomplete: string[] = []
  const userDoc = await ctx.db.get(user._id)
  if (!userDoc) return { percentage: 0, incomplete: ['User not found'], kind: 'not_started' }

  const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0
  const arr = (v: unknown) => Array.isArray(v) && v.length > 0

  const isCredentialDeepValid = (entries: unknown[], requireSpecialties: boolean) =>
    entries.every((e) => {
      const c = e as Record<string, unknown>
      if (requireSpecialties && !Array.isArray(c.specialtyRatings)) return false
      return str(c.agency) && str(c.level) && str(c.agencyID)
    })
  const isAssociationDeepValid = (entries: unknown[], checkRole: string) =>
    entries.every((e) => {
      const a = e as Record<string, unknown>
      if (!str(a.agency) || !str(a.number)) return false
      if (checkRole === 'DiveCenter') {
        const specs = a.selectedSpecialties
        if (!Array.isArray(specs)) return false
        const requiredCount = AOW_REQUIRED_SPECIALTY_COUNT
        if (specs.length < requiredCount) return false
      }
      return true
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

  for (const field of PROFILE_REQUIRED) {
    const value = (userDoc as Record<string, unknown>)[field]
    if (!str(value)) incomplete.push(field)
  }

  for (const field of SETTINGS_REQUIRED) {
    const value = (userDoc as Record<string, unknown>)[field]
    if (!str(value)) incomplete.push(field)
  }

  const table = ROLE_TABLE_MAP[role]
  let profile: Record<string, unknown> | null = null
  if (table) {
    let orgId = userDoc.organizationId
    if (!orgId) {
      const activeOrg = await tryGetActiveOrg(ctx)
      orgId = activeOrg?._id
    }
    if (orgId) {
      profile = await ctx.db
        .query(table as 'diveCenters')
        .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
        .unique()
    }
  }

  const roleFields = ROLE_REQUIRED[role] ?? []
  for (const field of roleFields) {
    if (!profile) {
      incomplete.push(field)
      continue
    }

    if (field === 'address') {
      const addr = profile.address as { city?: unknown; country?: unknown } | undefined
      if (!addr || !str(addr.city) || !str(addr.country)) incomplete.push(field)
      continue
    }

    if (role === 'Boat' && field === 'diveSite') {
      const fleet = profile.fleet as Array<{ routes?: Array<{ diveSite: string }> }> | undefined
      const hasDiveSite = fleet?.some(f => f.routes?.some(r => r.diveSite))
      if (!hasDiveSite) incomplete.push(field)
      continue
    }

    if (role === 'Equipment' && field === 'gearInventory') {
      const incompleteGearTypes = await evaluateGearInventoryCompleteness(ctx, userDoc.slug)
      if (incompleteGearTypes.length > 0) incomplete.push(field)
      continue
    }

    const value = profile[field]
    if (Array.isArray(value)) {
      if (!arr(value)) {
        incomplete.push(field)
      } else if (field === 'credential') {
        if (role === 'Instructor' && !isCredentialDeepValid(value, true)) {
          incomplete.push(field)
        }
      } else if (field === 'associations' && !isAssociationDeepValid(value, role)) {
        incomplete.push(field)
      } else if (field === 'fleet' && !isFleetDeepValid(value)) {
        incomplete.push(field)
      }
    } else {
      if (!str(value)) incomplete.push(field)
    }
  }

  const isOperator = OPERATOR_ROLE_SET.has(role)
  let prefsFieldCount = 0
  let prefs: Record<string, unknown> | null = null

  if (isOperator) {
    prefsFieldCount = 1 // acceptanceMode
    const prefsDoc = await ctx.db
      .query('stakeholderPreferences')
      .withIndex('by_stakeholderId', (q) => q.eq('stakeholderId', userDoc.slug))
      .unique()
    prefs = prefsDoc as Record<string, unknown> | null
    if (!prefs || !str(prefs.acceptanceMode)) {
      incomplete.push('acceptanceMode')
    }
  }

  let coverageFieldCount = 0

  if (isOperator) {
    coverageFieldCount = 4 // instructor, equipment, venueOrBoat, compressor
    const instrSlugs = (prefs?.preferredInstructorSlugs ?? []) as string[]
    const equipSlugs = (prefs?.preferredEquipmentSlugs ?? []) as string[]
    const venueSlugs = (prefs?.preferredVenueSlugs ?? []) as string[]
    const boatSlugs = (prefs?.preferredBoatSlugs ?? []) as string[]
    const compSlugs = (prefs?.preferredCompressorSlugs ?? []) as string[]

    if (instrSlugs.length === 0) incomplete.push('preferredInstructor')
    if (equipSlugs.length === 0) incomplete.push('preferredEquipment')
    if (venueSlugs.length === 0 && boatSlugs.length === 0) incomplete.push('preferredVenueOrBoat')

    let hasCompressor = compSlugs.length > 0
    if (!hasCompressor) {
      for (const slug of boatSlugs) {
        const boat = await profileBySlug(ctx, slug, 'boats')
        if (boat && (boat as { hasCompressor?: boolean }).hasCompressor) {
          hasCompressor = true
          break
        }
      }
    }
    if (!hasCompressor) incomplete.push('preferredCompressor')
  }

  const total = PROFILE_REQUIRED.length + SETTINGS_REQUIRED.length + roleFields.length + prefsFieldCount + coverageFieldCount
  const filled = total - incomplete.length
  const percentage = total === 0 ? 100 : Math.round((filled / total) * 100)

  const kind: CompletenessKind =
    table && !profile ? 'not_started' :
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

  const rolesToCheck = userRoles.map((r) => r.role)

  const roles: Array<{ role: string; percentage: number; incomplete: string[]; kind: CompletenessKind }> = []
  let allComplete = true

  for (const role of rolesToCheck) {
    const result = await checkProfileCompleteness(ctx, { _id: user._id }, role)
    roles.push({ role, ...result })
    if (result.percentage < 100) allComplete = false
  }

  return { allComplete, roles }
}
