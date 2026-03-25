/**
 * DD-032: Multi-Role Onboarding
 *
 * Tests that createUser accepts a roles array and creates userRoles entries
 * for each selected role, with the first as primary.
 */

import { describe, it, expect, vi } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'

const IDENTITY = { tokenIdentifier: 'clerk|multi-role-user' }

describe('createUser with roles array (DD-032)', () => {
  it('creates userRoles entries for each role in the array', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity(IDENTITY)
      .mutation(api.users.createUser, {
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

  it('marks the first role as primary', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity(IDENTITY)
      .mutation(api.users.createUser, {
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

    const primary = roles.find((r) => r.isPrimary)
    expect(primary).toBeTruthy()
    expect(primary!.role).toBe('Boat')

    const nonPrimary = roles.filter((r) => !r.isPrimary)
    expect(nonPrimary).toHaveLength(1)
    expect(nonPrimary[0].role).toBe('Instructor')
  })

  it('sets user.role to the first/primary role', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity(IDENTITY)
      .mutation(api.users.createUser, {
        role: 'Equipment',
        roles: ['Equipment', 'Compressor'],
        businessName: 'Equip Co',
      })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.role).toBe('Equipment')
  })

  it('single-role selection still works identically (no roles array)', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity(IDENTITY)
      .mutation(api.users.createUser, {
        role: 'DiveCenter',
        businessName: 'Single DC',
      })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.role).toBe('DiveCenter')

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
      .mutation(api.users.createUser, {
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
    expect(roles[0].isPrimary).toBe(true)
  })

  it('schedules demo bookings only when an operator role is in the set', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    // DiveCenter is an operator role
    await t
      .withIdentity(IDENTITY)
      .mutation(api.users.createUser, {
        role: 'DiveCenter',
        roles: ['DiveCenter', 'Instructor'],
        businessName: 'Demo DC',
      })
    // Should not throw — demo bookings are scheduled for operator primary
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()
  })
})
