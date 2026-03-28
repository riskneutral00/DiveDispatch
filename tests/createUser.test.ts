import { describe, it, expect, vi } from 'vitest'
import { ConvexError, type Value } from 'convex/values'
import { api } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'

describe('createUser mutation', () => {
  it('persists phone', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity({ tokenIdentifier: 'clerk|phone-user' })
      .mutation(api.users.createUser, {
        role: 'DiveCenter',
        businessName: 'Test DC',
        phone: '+66123456789',
      })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.phone).toBe('+66123456789')
  })

  it('persists explicit firstName, lastName, nickname', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity({ tokenIdentifier: 'clerk|named-user' })
      .mutation(api.users.createUser, {
        role: 'Instructor',
        businessName: 'Captain Mike',
        firstName: 'Mike',
        lastName: 'Johnson',
        nickname: 'Captain Mike',
      })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.firstName).toBe('Mike')
    expect(user?.lastName).toBe('Johnson')
    expect(user?.nickname).toBe('Captain Mike')
  })

  it('defaults phone to undefined when omitted', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity({ tokenIdentifier: 'clerk|no-phone' })
      .mutation(api.users.createUser, {
        role: 'DiveCenter',
        businessName: 'Test DC',
      })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.phone).toBeUndefined()
  })

  it('patches existing user with new fields on idempotent call', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|idem-user' }

    // First call creates the user
    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      role: 'DiveCenter',
      businessName: 'Old Biz',
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    // Second call patches with new data
    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      role: 'Agent',
      businessName: 'New Biz',
      phone: '+1234567890',
      nickname: 'Updated Nick',
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t
      .withIdentity(identity)
      .query(api.users.me, {})
    expect(user?.businessName).toBe('New Biz')
    expect(user?.phone).toBe('+1234567890')
    expect(user?.nickname).toBe('Updated Nick')
  })
})

describe('createUser rate limiting', () => {
  it('rejects the 4th call within a minute with RATE_LIMITED', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|rate-limit-user' }

    // createUser allows 3 per minute — exhaust all 3 (idempotent re-calls still consume tokens)
    for (let i = 0; i < 3; i++) {
      vi.useFakeTimers({ now: Date.now() })
      await t.withIdentity(identity).mutation(api.users.createUser, {
        role: 'DiveCenter',
        businessName: 'Rate Test DC',
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
      vi.useRealTimers()
    }

    // 4th call should throw RATE_LIMITED
    try {
      vi.useFakeTimers({ now: Date.now() })
      await t.withIdentity(identity).mutation(api.users.createUser, {
        role: 'DiveCenter',
        businessName: 'Rate Test DC',
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
      vi.useRealTimers()
      expect.fail('Expected ConvexError to be thrown')
    } catch (err) {
      vi.useRealTimers()
      expect(err).toBeInstanceOf(ConvexError)
      const raw = (err as ConvexError<Value>).data
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      expect(data.code).toBe('RATE_LIMITED')
    }
  })

  it('allows calls from a different identity after one is exhausted', async () => {
    const t = makeT()
    const identityA = { tokenIdentifier: 'clerk|rate-a' }
    const identityB = { tokenIdentifier: 'clerk|rate-b' }

    // Exhaust limit for identity A (3 calls)
    for (let i = 0; i < 3; i++) {
      vi.useFakeTimers({ now: Date.now() })
      await t.withIdentity(identityA).mutation(api.users.createUser, {
        role: 'DiveCenter',
        businessName: 'DC A',
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
      vi.useRealTimers()
    }

    // Identity B should still work
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t.withIdentity(identityB).mutation(api.users.createUser, {
      role: 'DiveCenter',
      businessName: 'DC B',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(typeof userId).toBe('string')
  })
})

describe('updateBusinessInfo mutation', () => {
  it('patches businessName and customerLanguages on existing user', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|biz-user' }

    // Create user first
    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      role: 'DiveCenter',
      businessName: 'Placeholder',
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    // Patch business info
    await t.withIdentity(identity).mutation(api.users.updateBusinessInfo, {
      businessName: 'Real Dive Shop',
    })

    const user = await t.withIdentity(identity).query(api.users.me, {})
    expect(user?.businessName).toBe('Real Dive Shop')
  })

  it('rejects unauthenticated calls', async () => {
    const t = makeT()
    await expect(
      t.mutation(api.users.updateBusinessInfo, {
        businessName: 'Hacker',
      }),
    ).rejects.toThrow()
  })

  it('rejects when no user record exists', async () => {
    const t = makeT()
    await expect(
      t
        .withIdentity({ tokenIdentifier: 'clerk|ghost' })
        .mutation(api.users.updateBusinessInfo, {
          businessName: 'Ghost Biz',
        }),
    ).rejects.toThrow()
  })
})
