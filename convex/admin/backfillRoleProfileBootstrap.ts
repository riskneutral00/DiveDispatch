import { mutation } from '../_generated/server'
import { v } from 'convex/values'
import { requireDevEnvironment } from '../lib/devGuard'
import { ROLE_SPECS, isPersonRole, isEntityRole } from '../shared/roleKinds'
import { mintUniqueEntitySlug } from '../lib/entitySlug'
import type { Id, TableNames } from '../_generated/dataModel'

const ENTITY_SLUG_TABLES = new Set<TableNames>(['diveCenters', 'boats', 'equipment', 'compressors'])
const BOOTSTRAP_ADDRESS = { city: '', country: '' }

export const run = mutation({
  args: {},
  returns: v.object({
    rowsCreated: v.number(),
    rolesScanned: v.number(),
    venueSkipped: v.number(),
  }),
  handler: async (ctx) => {
    requireDevEnvironment()

    const allRoles = await ctx.db.query('userRoles').collect() // bounded: dev backfill, max ~few hundred
    let rowsCreated = 0
    let venueSkipped = 0

    for (const role of allRoles) {
      if (role.role === 'Venue') {
        venueSkipped += 1
        continue
      }
      if (!isPersonRole(role.role) && !isEntityRole(role.role)) continue

      const tableName = ROLE_SPECS[role.role].table
      const user = await ctx.db.get(role.userId) // batch-exempt: dev backfill, sequential per-row processing
      if (!user) continue
      const org = await ctx.db.get(role.organizationId as Id<'organizations'>) // batch-exempt: dev backfill, sequential
      if (!org) continue

      const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
      const isEntity = isEntityRole(role.role)

      const existing = await ctx.db
        .query(tableName)
        .withIndex('by_organizationId', (q) => q.eq('organizationId', role.organizationId))
        .first() // batch-exempt: dev backfill, sequential per-row processing
      if (existing) continue

      const baseName = isEntity ? org.name : fullName
      const payload: Record<string, unknown> = {
        organizationId: role.organizationId,
        name: baseName,
        email: user.email ?? '',
        phone: user.phone ?? '',
        address: BOOTSTRAP_ADDRESS,
        lat: 0,
        lng: 0,
        verified: false,
      }

      if (role.role === 'Instructor') {
        payload.role = 'Instructor'
        payload.credential = []
        payload.teachingLanguages = []
      } else if (role.role === 'Agent') {
        payload.associations = []
      } else if (role.role === 'DiveCenter') {
        payload.associations = []
      } else if (role.role === 'Boat') {
        payload.fleet = []
      }

      if (ENTITY_SLUG_TABLES.has(tableName)) {
        payload.slug = await mintUniqueEntitySlug(ctx, tableName as 'diveCenters' | 'boats' | 'equipment' | 'compressors' | 'venues', baseName) // batch-exempt: dev backfill, sequential
      }

      await (ctx.db.insert as (t: TableNames, p: unknown) => Promise<unknown>)(tableName, payload) // batch-exempt: dev backfill, sequential
      rowsCreated += 1
    }

    return { rowsCreated, rolesScanned: allRoles.length, venueSkipped }
  },
})
