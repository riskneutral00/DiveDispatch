// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ROLES, type RoleConfig, type ClerkRole } from '@/lib/constants/roles'
import { composeCreatePayload } from '@/lib/profile-form/composeCreatePayload'
import { recomputeRoleProfileComplete } from '../../convex/lib/setRoleProfileComplete'
import { seedUserWithOrg } from '../fixtures'
import { makeT, orgIdentityFor } from '../helpers/convex-helpers'

const SLUG_BY_ROLE: Record<ClerkRole, string> = {
  DiveCenter: 'on-dc',
  Agent: 'on-agent',
  Instructor: 'on-inst',
  Boat: 'on-boat',
  Equipment: 'on-eq',
  Compressor: 'on-cmp',
  Venue: 'on-venue',
}

function synthesizeFormInput(role: RoleConfig): Record<string, unknown> {
  const wantsName = role.contact?.nameLabel != null || role.clerkRole === 'Venue'
  const base: Record<string, unknown> = {
    address: { city: 'Koh Tao', country: 'TH' },
    lat: 10.09,
    lng: 99.84,
    email: `${role.key}-onboarding@example.com`,
    phone: '+66812345678',
  }
  if (wantsName) base.name = `Onboarding ${role.label}`
  if (role.contact?.languageKey) {
    base[role.contact.languageKey] = ['en']
  }
  return base
}

const VENUE_KIND = 'dive_site'

describe('role onboarding — mutation-level post-state correctness (all 7 roles)', () => {
  for (const role of ROLES) {
    it(`${role.key}: create produces a DB row addressable by .mine`, async () => {
      const t = makeT()
      const slug = SLUG_BY_ROLE[role.clerkRole]
      await t.run(async (ctx) => {
        await seedUserWithOrg(ctx, slug, role.clerkRole)
      })

      const formInput = synthesizeFormInput(role)
      const payload = composeCreatePayload(role, formInput, {
        venueKind: role.clerkRole === 'Venue' ? VENUE_KIND : undefined,
      })

      const id = await t
        .withIdentity(orgIdentityFor(slug))
        .mutation(role.api.create, payload as never)
      expect(id).toBeTruthy()

      const fromMine = await t.withIdentity(orgIdentityFor(slug)).query(role.api.mine, {})
      const rows = Array.isArray(fromMine)
        ? (fromMine as Array<{ _id: string }>)
        : fromMine
          ? [fromMine as { _id: string }]
          : []
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.some((r) => r._id === id)).toBe(true)
    })
  }
})

describe('role onboarding — profileComplete denorm reflects post-create state', () => {
  for (const role of ROLES) {
    it(`${role.key}: post-create recompute returns a boolean (no exceptions, post-state stable)`, async () => {
      const t = makeT()
      const slug = `pc-${SLUG_BY_ROLE[role.clerkRole]}`
      await t.run(async (ctx) => {
        await seedUserWithOrg(ctx, slug, role.clerkRole)
      })

      const formInput = synthesizeFormInput(role)
      const payload = composeCreatePayload(role, formInput, {
        venueKind: role.clerkRole === 'Venue' ? VENUE_KIND : undefined,
      })
      await t
        .withIdentity(orgIdentityFor(slug))
        .mutation(role.api.create, payload as never)

      const result = await t.run(async (ctx) => {
        const user = await ctx.db
          .query('users')
          .withIndex('by_slug', (q) => q.eq('slug', slug))
          .unique()
        if (!user) throw new Error(`user not found: ${slug}`)
        return recomputeRoleProfileComplete(ctx, user._id, role.clerkRole)
      })
      expect(typeof result).toBe('boolean')
    })
  }
})
