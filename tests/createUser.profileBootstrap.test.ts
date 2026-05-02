import { describe, it, expect, vi } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'
import { createUserDefaults } from './helpers/createUser'
import { ROLE_SPECS, isPersonRole, isEntityRole } from '../convex/shared/roleKinds'

const ENTITY_ROLES_TO_TEST = ['Compressor', 'Boat', 'Equipment', 'DiveCenter'] as const
const PERSON_ROLES_TO_TEST = ['Instructor', 'Agent'] as const

describe('createUser profile-row bootstrap', () => {
  it.each(ENTITY_ROLES_TO_TEST)('bootstraps %s entity row with inherited contact', async (role) => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity({ tokenIdentifier: `clerk|bootstrap-${role}`, email: `${role.toLowerCase()}@test.com` })
      .mutation(api.users.createUser, { ...createUserDefaults, role, roles: [role] })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const tableName = ROLE_SPECS[role].table
    const rows = await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      if (!user?.organizationId) return []
      return await ctx.db
        .query(tableName)
        .withIndex('by_organizationId', (q) => q.eq('organizationId', user.organizationId!))
        .collect()
    })

    expect(rows).toHaveLength(1)
    const row = rows[0] as Record<string, unknown>
    expect(row.email).toBe(`${role.toLowerCase()}@test.com`)
    expect(row.phone).toBe(createUserDefaults.phone)
    expect(typeof row.name).toBe('string')
    expect((row.name as string).length).toBeGreaterThan(0)
    expect(row.verified).toBe(false)
    expect(row.lat).toBe(0)
    expect(row.lng).toBe(0)
    expect((row.address as { city: string; country: string }).city).toBe('')
    expect((row.address as { city: string; country: string }).country).toBe('')
    expect(typeof row.slug).toBe('string')
  })

  it.each(PERSON_ROLES_TO_TEST)('bootstraps %s person row with name from firstName+lastName', async (role) => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity({ tokenIdentifier: `clerk|bootstrap-${role}`, email: `${role.toLowerCase()}@test.com` })
      .mutation(api.users.createUser, { ...createUserDefaults, role, roles: [role], firstName: 'Pat', lastName: 'Diver' })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const tableName = ROLE_SPECS[role].table
    const row = await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      if (!user?.organizationId) return null
      return await ctx.db
        .query(tableName)
        .withIndex('by_organizationId', (q) => q.eq('organizationId', user.organizationId!))
        .unique()
    })

    expect(row).not.toBeNull()
    const r = row as Record<string, unknown>
    expect(r.name).toBe('Pat Diver')
    expect(r.email).toBe(`${role.toLowerCase()}@test.com`)
    expect(r.phone).toBe(createUserDefaults.phone)
    expect(r.verified).toBe(false)
    if (role === 'Instructor') {
      expect(r.credential).toEqual([])
      expect(r.teachingLanguages).toEqual([])
    } else if (role === 'Agent') {
      expect(r.associations).toEqual([])
    }
  })

  it('skips Venue role at bootstrap', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity({ tokenIdentifier: 'clerk|bootstrap-venue', email: 'venue@test.com' })
      .mutation(api.users.createUser, { ...createUserDefaults, role: 'Venue', roles: ['Venue'] })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const venues = await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      if (!user?.organizationId) return []
      return await ctx.db
        .query('venues')
        .withIndex('by_organizationId', (q) => q.eq('organizationId', user.organizationId!))
        .collect()
    })

    expect(venues).toHaveLength(0)
  })

  it('is idempotent — second createUser call does not duplicate the entity row', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|bootstrap-idempotent', email: 'idem@test.com' }

    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, { ...createUserDefaults, role: 'Compressor', roles: ['Compressor'] })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    await t.withIdentity(identity).mutation(api.users.createUser, { ...createUserDefaults, role: 'Compressor', roles: ['Compressor'] })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const compressors = await t.run(async (ctx) => ctx.db.query('compressors').collect())
    expect(compressors).toHaveLength(1)
  })

  it('Compressor signup yields 82% completion (9/11 slots filled)', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity({ tokenIdentifier: 'clerk|bootstrap-percentage', email: 'pct@test.com' })
      .mutation(api.users.createUser, { ...createUserDefaults, role: 'Compressor', roles: ['Compressor'] })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const result = await t
      .withIdentity({ tokenIdentifier: 'clerk|bootstrap-percentage', email: 'pct@test.com' })
      .query(api.users.getOnboardingStatus, {})

    expect(result.percentage).toBe(82)
    expect(result.incomplete).toContain('address')
    expect(result.incomplete).toContain('gasMixes')
    expect(result.incomplete).not.toContain('name')
    expect(result.incomplete).not.toContain('email')
    expect(result.incomplete).not.toContain('phone')

    void userId
    void isPersonRole
    void isEntityRole
  })
})
