// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { ROLES, type RoleConfig, type ClerkRole } from '@/lib/constants/roles'
import { composeCreatePayload } from '@/lib/profile-form/composeCreatePayload'
import { seedUserWithOrg } from '../fixtures'
import { makeT, orgIdentityFor } from '../helpers/convex-helpers'

const SLUG_BY_ROLE: Record<ClerkRole, string> = {
  DiveCenter: 'rt-dc',
  Agent: 'rt-agent',
  Instructor: 'rt-inst',
  Boat: 'rt-boat',
  Equipment: 'rt-eq',
  Compressor: 'rt-cmp',
  Venue: 'rt-venue',
}

function synthesizeFormInput(role: RoleConfig): Record<string, unknown> {
  const wantsName = role.contact?.nameLabel != null || role.clerkRole === 'Venue'
  const base: Record<string, unknown> = {
    address: { city: 'Koh Tao', country: 'TH' },
    lat: 10.09,
    lng: 99.84,
    email: `${role.key}-runtime@example.com`,
    phone: '+66812345678',
  }
  if (wantsName) base.name = `Runtime ${role.label}`
  if (role.contact?.languageKey) {
    base[role.contact.languageKey] = ['en']
  }
  return base
}

const VENUE_KIND = 'dive_site'

describe('role create — runtime composition harness', () => {
  for (const role of ROLES) {
    it(`${role.key}: composeCreatePayload output satisfies *.create validator`, async () => {
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
    })
  }
})

describe('role create — negative coverage proves harness detects drift', () => {
  it('boat.create rejects when fleet is missing (composeCreatePayload contract gap)', async () => {
    const t = makeT()
    const slug = 'rt-boat-neg'
    await t.run(async (ctx) => {
      await seedUserWithOrg(ctx, slug, 'Boat')
    })

    const role = ROLES.find((r) => r.key === 'boat')!
    const formInput = synthesizeFormInput(role)
    const payloadMissingFleet = { ...formInput }

    await expect(
      t.withIdentity(orgIdentityFor(slug)).mutation(role.api.create, payloadMissingFleet as never),
    ).rejects.toThrow()
  })

  it('agent.create rejects when associations is missing', async () => {
    const t = makeT()
    const slug = 'rt-agent-neg'
    await t.run(async (ctx) => {
      await seedUserWithOrg(ctx, slug, 'Agent')
    })

    const role = ROLES.find((r) => r.key === 'agent')!
    const formInput = synthesizeFormInput(role)

    await expect(
      t.withIdentity(orgIdentityFor(slug)).mutation(role.api.create, formInput as never),
    ).rejects.toThrow()
  })

  it('dive-center.create rejects when associations is missing', async () => {
    const t = makeT()
    const slug = 'rt-dc-neg'
    await t.run(async (ctx) => {
      await seedUserWithOrg(ctx, slug, 'DiveCenter')
    })

    const role = ROLES.find((r) => r.key === 'dive-center')!
    const formInput = synthesizeFormInput(role)

    await expect(
      t.withIdentity(orgIdentityFor(slug)).mutation(role.api.create, formInput as never),
    ).rejects.toThrow()
  })

  it('instructor.create rejects when credential is missing', async () => {
    const t = makeT()
    const slug = 'rt-inst-neg'
    await t.run(async (ctx) => {
      await seedUserWithOrg(ctx, slug, 'Instructor')
    })

    const role = ROLES.find((r) => r.key === 'instructor')!
    const formInput = synthesizeFormInput(role)

    await expect(
      t.withIdentity(orgIdentityFor(slug)).mutation(api.diveStaff.create, formInput as never),
    ).rejects.toThrow()
  })

  it('venue.create rejects when kind/features missing (would happen if wizard skipped)', async () => {
    const t = makeT()
    const slug = 'rt-venue-neg'
    await t.run(async (ctx) => {
      await seedUserWithOrg(ctx, slug, 'Venue')
    })

    const role = ROLES.find((r) => r.key === 'venue')!
    const formInput = synthesizeFormInput(role)

    await expect(
      t.withIdentity(orgIdentityFor(slug)).mutation(role.api.create, formInput as never),
    ).rejects.toThrow()
  })
})
