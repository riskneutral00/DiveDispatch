import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ConvexError, type Value } from 'convex/values'
import { api } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'
import { seedUser } from './fixtures/seedUsers'
import type { Id } from '../convex/_generated/dataModel'

describe('devSwitchUser — token park + restore', () => {
  beforeEach(() => {
    vi.stubEnv('ENVIRONMENT', 'development')
    vi.stubEnv('ALLOW_DEV_SWITCH', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('single switch A→B: parks A, rebinds B to caller token', async () => {
    const t = makeT()
    const tokenA = 'clerk|switcher-A'
    const tokenB = 'clerk|switcher-B'

    const [idA, idB] = await t.run(async (ctx) => {
      const a = await seedUser(ctx, {
        tokenIdentifier: tokenA,
        slug: 'switcher-a',
        role: 'Instructor',
        email: 'a@example.com',
      })
      const b = await seedUser(ctx, {
        tokenIdentifier: tokenB,
        slug: 'switcher-b',
        role: 'DiveCenter',
        email: 'b@example.com',
      })
      return [a, b] as [Id<'users'>, Id<'users'>]
    })

    await t
      .withIdentity({ tokenIdentifier: tokenA })
      .mutation(api.devSwitcher.devSwitchUser, { targetSlug: 'switcher-b' })

    const [a, b] = await t.run(async (ctx) => [
      await ctx.db.get(idA),
      await ctx.db.get(idB),
    ])
    expect(a?.tokenIdentifier).toMatch(/^parked\|switcher-a\|\d+$/)
    expect(b?.tokenIdentifier).toBe(tokenA)
  })

  it('double switch A→B→C: parks B and rebinds C', async () => {
    const t = makeT()
    const tokenA = 'clerk|restore-A'
    const tokenB = 'clerk|restore-B'
    const tokenC = 'clerk|restore-C'

    const [idA, idB, idC] = await t.run(async (ctx) => {
      const a = await seedUser(ctx, {
        tokenIdentifier: tokenA,
        slug: 'restore-a',
        role: 'Instructor',
        email: 'a@example.com',
      })
      const b = await seedUser(ctx, {
        tokenIdentifier: tokenB,
        slug: 'restore-b',
        role: 'DiveCenter',
        email: 'b@example.com',
      })
      const c = await seedUser(ctx, {
        tokenIdentifier: tokenC,
        slug: 'restore-c',
        role: 'Compressor',
        email: 'c@example.com',
      })
      return [a, b, c] as [Id<'users'>, Id<'users'>, Id<'users'>]
    })

    await t
      .withIdentity({ tokenIdentifier: tokenA })
      .mutation(api.devSwitcher.devSwitchUser, { targetSlug: 'restore-b' })

    await t
      .withIdentity({ tokenIdentifier: tokenA })
      .mutation(api.devSwitcher.devSwitchUser, { targetSlug: 'restore-c' })

    const [a, b, c] = await t.run(async (ctx) => [
      await ctx.db.get(idA),
      await ctx.db.get(idB),
      await ctx.db.get(idC),
    ])

    expect(b?.tokenIdentifier).toMatch(/^parked\|restore-b\|\d+$/)
    expect(c?.tokenIdentifier).toBe(tokenA)
    expect(a?.tokenIdentifier).toMatch(/^parked\|restore-a\|\d+$/)
  })

  it('idempotent A→A: early return, no DB writes', async () => {
    const t = makeT()
    const tokenA = 'clerk|idem-A'

    const idA = await t.run(async (ctx) =>
      seedUser(ctx, {
        tokenIdentifier: tokenA,
        slug: 'idem-a',
        role: 'Instructor',
        email: 'a@example.com',
      }),
    )

    const before = await t.run(async (ctx) => ctx.db.get(idA))

    await t
      .withIdentity({ tokenIdentifier: tokenA })
      .mutation(api.devSwitcher.devSwitchUser, { targetSlug: 'idem-a' })

    const after = await t.run(async (ctx) => ctx.db.get(idA))

    expect(after?.tokenIdentifier).toBe(before?.tokenIdentifier)
    expect(after?._creationTime).toBe(before?._creationTime)
  })
})

describe('devSwitchUser — dual env gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('throws FORBIDDEN when ALLOW_DEV_SWITCH is unset even in development', async () => {
    vi.stubEnv('ENVIRONMENT', 'development')
    vi.stubEnv('ALLOW_DEV_SWITCH', '')

    const t = makeT()
    const tokenA = 'clerk|gate-A'

    await t.run(async (ctx) =>
      seedUser(ctx, {
        tokenIdentifier: tokenA,
        slug: 'gate-a',
        role: 'Instructor',
      }),
    )

    try {
      await t
        .withIdentity({ tokenIdentifier: tokenA })
        .mutation(api.devSwitcher.devSwitchUser, { targetSlug: 'gate-a' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      const raw = (err as ConvexError<Value>).data
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      expect(data.code).toBe('FORBIDDEN')
    }
  })

  it('listAllUsers throws FORBIDDEN when ALLOW_DEV_SWITCH is unset', async () => {
    vi.stubEnv('ENVIRONMENT', 'development')
    vi.stubEnv('ALLOW_DEV_SWITCH', '')

    const t = makeT()

    try {
      await t
        .withIdentity({ tokenIdentifier: 'clerk|list-caller' })
        .query(api.devSwitcher.listAllUsers, {})
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      const raw = (err as ConvexError<Value>).data
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      expect(data.code).toBe('FORBIDDEN')
    }
  })

  it('listAllUsers throws UNAUTHENTICATED when no identity is present', async () => {
    vi.stubEnv('ENVIRONMENT', 'development')
    vi.stubEnv('ALLOW_DEV_SWITCH', 'true')

    const t = makeT()

    try {
      await t.query(api.devSwitcher.listAllUsers, {})
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      const raw = (err as ConvexError<Value>).data
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      expect(data.code).toBe('UNAUTHENTICATED')
    }
  })
})
