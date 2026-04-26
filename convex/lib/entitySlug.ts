import { ConvexError } from 'convex/values'
import { ErrorCode } from './errorCodes'
import type { QueryCtx } from '../_generated/server'
import type { TableNames } from '../_generated/dataModel'
import { queryDynamicTable } from './typedDb'

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/
const SLUG_MIN = 3
const SLUG_MAX = 64

const ENTITY_SLUG_PREFIX: Record<string, string> = {
  diveCenters: 'dc',
  boats: 'boat',
  equipment: 'eq',
  venues: 'venue',
  compressors: 'comp',
}

export function deriveDefaultEntitySlug(table: TableNames, userSlug: string): string {
  const prefix = ENTITY_SLUG_PREFIX[table]
  if (!prefix) throw new Error(`deriveDefaultEntitySlug called on non-entity table: ${table}`)
  return `${prefix}-${userSlug}`
}

export function assertEntitySlug(slug: string, field = 'slug'): void {
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new ConvexError({ code: ErrorCode.VALIDATION, reason: `${field}_required` })
  }
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
    throw new ConvexError({ code: ErrorCode.VALIDATION, reason: `${field}_length` })
  }
  if (!SLUG_REGEX.test(slug)) {
    throw new ConvexError({ code: ErrorCode.VALIDATION, reason: `${field}_format` })
  }
}

export async function assertEntitySlugUnique(
  ctx: QueryCtx,
  table: TableNames,
  slug: string,
): Promise<void> {
  const existing = await queryDynamicTable(ctx.db, table)
    .withIndex('by_slug', (q) => q.eq('slug', slug))
    .first()
  if (existing) {
    throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'slug_taken' })
  }
}
