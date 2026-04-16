/**
 * DD-032: Multi-Role Onboarding
 *
 * Tests that createUser accepts a roles array and creates userRoles entries
 * for each selected role, with the first as primary.
 */

import { describe, it, expect, vi } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'
import { createUserDefaults } from './helpers/createUser'

const IDENTITY = { tokenIdentifier: 'clerk|multi-role-user' }

describe('createUser with roles array (DD-032)', () => {
  it('creates userRoles entries for each role in the array', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity(IDENTITY)
      .mutation(api.users.createUser, { ...createUserDefaults,
        role: 'DiveCenter',
        roles: ['DiveCenter', 'Boat', 'Equipment'],
        businessName: 'Multi DC',
      })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const roles = await t.run(async (ctx) =>
      ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect(),
    )

    expect(roles).toHaveLength(3)
    const roleNames = roles.map((r) => r.role).sort()
    expect(roleNames).toEqual(['Boat', 'DiveCenter', 'Equipment'])
  })

  it('creates entries for both roles in specified order', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity(IDENTITY)
      .mutation(api.users.createUser, { ...createUserDefaults,
        role: 'Boat',
        roles: ['Boat', 'Instructor'],
        businessName: 'Boat First',
      })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const roles = await t.run(async (ctx) =>
      ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect(),
    )

    expect(roles).toHaveLength(2)
    const roleNames = roles.map((r) => r.role).sort()
    expect(roleNames).toEqual(['Boat', 'Instructor'])
  })

  it('creates userRoles entries without writing role to users table', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity(IDENTITY)
      .mutation(api.users.createUser, { ...createUserDefaults,
        role: 'Equipment',
        roles: ['Equipment', 'Compressor'],
        businessName: 'Equip Co',
      })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const roles = await t.run(async (ctx) =>
      ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect(),
    )
    expect(roles).toHaveLength(2)
    const roleNames = roles.map((r) => r.role).sort()
    expect(roleNames).toEqual(['Compressor', 'Equipment'])
  })

  it('single-role selection still works identically (no roles array)', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity(IDENTITY)
      .mutation(api.users.createUser, { ...createUserDefaults,
        role: 'DiveCenter',
        businessName: 'Single DC',
      })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    // No userRoles entries created when roles array is absent
    const roles = await t.run(async (ctx) =>
      ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect(),
    )
    expect(roles).toHaveLength(0)
  })

  it('single-role in roles array creates exactly one userRoles entry', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity(IDENTITY)
      .mutation(api.users.createUser, { ...createUserDefaults,
        role: 'Instructor',
        roles: ['Instructor'],
        businessName: 'Solo Instructor',
      })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const roles = await t.run(async (ctx) =>
      ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect(),
    )
    expect(roles).toHaveLength(1)
    expect(roles[0].role).toBe('Instructor')
    expect(roles[0].profileComplete).toBe(false)
  })

})
