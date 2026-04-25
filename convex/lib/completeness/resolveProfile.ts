import type { QueryCtx } from '../../_generated/server'
import type { Doc, Id, TableNames } from '../../_generated/dataModel'
import { ROLE_TABLE_MAP } from '../profileHelpers'
import { queryDynamicTable } from '../typedDb'
import { str } from './types'

type ProfileDoc = Record<string, unknown>

export interface ProfileResolution {
  profile: ProfileDoc | null
  activeOrgId: Id<'organizations'> | null
}

type ProfilePicker = (docs: ProfileDoc[]) => ProfileDoc | null

const VENUE_REQUIRED_FIELDS = ['name', 'address', 'kind'] as const

function countVenueMissing(venue: ProfileDoc): number {
  let missing = 0
  for (const f of VENUE_REQUIRED_FIELDS) {
    if (f === 'address') {
      const addr = venue.address as { city?: unknown; country?: unknown } | undefined
      if (!addr || !str(addr.city) || !str(addr.country)) missing += 1
      continue
    }
    if (!str(venue[f])) missing += 1
  }
  return missing
}

const VENUE_PICKER: ProfilePicker = (docs) => {
  if (docs.length === 0) return null
  let best = docs[0]
  let bestMissing = countVenueMissing(best)
  for (let i = 1; i < docs.length; i += 1) {
    const m = countVenueMissing(docs[i])
    if (m < bestMissing) {
      best = docs[i]
      bestMissing = m
    }
  }
  return best
}

const COMPRESSOR_REQUIRED_FIELDS = ['name', 'address', 'location'] as const

function countCompressorMissing(c: ProfileDoc): number {
  let missing = 0
  for (const f of COMPRESSOR_REQUIRED_FIELDS) {
    if (f === 'address') {
      const addr = c.address as { city?: unknown; country?: unknown } | undefined
      if (!addr || !str(addr.city) || !str(addr.country)) missing += 1
      continue
    }
    if (!str(c[f])) missing += 1
  }
  return missing
}

const COMPRESSOR_PICKER: ProfilePicker = (docs) => {
  if (docs.length === 0) return null
  let best = docs[0]
  let bestMissing = countCompressorMissing(best)
  for (let i = 1; i < docs.length; i += 1) {
    const m = countCompressorMissing(docs[i])
    if (m < bestMissing) {
      best = docs[i]
      bestMissing = m
    }
  }
  return best
}

const PICKERS: Record<string, ProfilePicker> = {
  Venue: VENUE_PICKER,
  Compressor: COMPRESSOR_PICKER,
}

export async function resolveRoleProfile(
  ctx: QueryCtx,
  userDoc: Doc<'users'>,
  role: string,
): Promise<ProfileResolution> {
  const activeOrgId = userDoc.organizationId ?? null

  const table = ROLE_TABLE_MAP[role] as TableNames | undefined
  if (!table || !activeOrgId) {
    return { profile: null, activeOrgId }
  }

  const membership = await ctx.db
    .query('userRoles')
    .withIndex('by_userId', (q) => q.eq('userId', userDoc._id))
    .filter((q) => q.eq(q.field('organizationId'), activeOrgId))
    .first()
  if (!membership) {
    return { profile: null, activeOrgId: null }
  }

  const picker = PICKERS[role]
  if (picker) {
    const docs = await queryDynamicTable(ctx.db, table)
      .withIndex('by_organizationId', (q) => q.eq('organizationId', activeOrgId))
      .collect() // bounded: per-org multi-row (venues) realistic cap ~20
    return { profile: picker(docs as unknown as ProfileDoc[]), activeOrgId }
  }

  const doc = await queryDynamicTable(ctx.db, table)
    .withIndex('by_organizationId', (q) => q.eq('organizationId', activeOrgId))
    .unique()
  return { profile: (doc as ProfileDoc | null), activeOrgId }
}
