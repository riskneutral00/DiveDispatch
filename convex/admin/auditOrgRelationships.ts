import { query } from '../_generated/server'
import { v } from 'convex/values'
import { queryAllDynamicTable } from '../lib/typedDb'
import { requireDevEnvironment } from '../lib/devGuard'

const PROFILE_TABLES = [
  'compressors',
  'equipment',
  'boats',
  'venues',
  'diveCenters',
  'diveStaff',
  'agents',
  'liveaboards',
  'diveResorts',
  'diveHostels',
] as const

const violationSchema = v.object({
  invariant: v.string(),
  detail: v.string(),
})

export const run = query({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    summary: v.object({
      users: v.number(),
      orgs: v.number(),
      roles: v.number(),
    }),
    violations: v.array(violationSchema),
  }),
  handler: async (ctx) => {
    requireDevEnvironment()

    const users = await ctx.db.query('users').collect() // bounded: dev verification, low cardinality
    const orgs = await ctx.db.query('organizations').collect() // bounded: dev verification, low cardinality
    const roles = await ctx.db.query('userRoles').collect() // bounded: dev verification, low cardinality

    const orgIds = new Set(orgs.map((o) => o._id))
    const usersById = new Map(users.map((u) => [u._id, u]))
    const violations: Array<{ invariant: string; detail: string }> = []

    for (const u of users) {
      if (u.organizationId && !orgIds.has(u.organizationId)) {
        violations.push({
          invariant: '1',
          detail: `user ${u._id} (slug='${u.slug}') has organizationId='${u.organizationId}' that does not exist`,
        })
      }
    }

    for (const r of roles) {
      if (!r.organizationId) {
        violations.push({
          invariant: '2',
          detail: `userRoles ${r._id} (role='${r.role}', userId='${r.userId}') has no organizationId`,
        })
      }
    }

    for (const r of roles) {
      const u = usersById.get(r.userId)
      if (u && u.organizationId !== r.organizationId) {
        violations.push({
          invariant: '3',
          detail: `userRoles ${r._id} (role='${r.role}') org='${r.organizationId}' but user ${u._id} (slug='${u.slug}') org='${u.organizationId}'`,
        })
      }
    }

    for (const table of PROFILE_TABLES) {
      const rows = await queryAllDynamicTable(ctx.db, table).collect() // bounded: dev verification, low cardinality
      for (const row of rows) {
        const orgId = (row as { organizationId?: string }).organizationId
        if (orgId && !orgIds.has(orgId as never)) {
          violations.push({
            invariant: '4',
            detail: `${table} row ${(row as { _id: string })._id} has organizationId='${orgId}' that does not exist`,
          })
        }
      }
    }

    for (const o of orgs) {
      if (o.clerkOrgId && /^seed_org_/.test(o.clerkOrgId)) {
        violations.push({
          invariant: '5',
          detail: `org ${o._id} (slug='${o.slug}') has ghost seed clerkOrgId='${o.clerkOrgId}'`,
        })
      }
    }

    return {
      ok: violations.length === 0,
      summary: {
        users: users.length,
        orgs: orgs.length,
        roles: roles.length,
      },
      violations,
    }
  },
})
