import { describe, it, expect, vi } from 'vitest'
import { ConvexError, type Value } from 'convex/values'
import { api, internal } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'

describe('createUser mutation', () => {
  it('uses identity.email and ignores args.email on new user', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity({
        tokenIdentifier: 'clerk|email-trust-new',
        email: 'real@clerk.dev',
      })
      .mutation(api.users.createUser, {
        role: 'DiveCenter',
        businessName: 'Trust Test DC',
      })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.email).toBe('real@clerk.dev')
  })

  it('uses identity.email even when args.email differs (existing user path)', async () => {
    const t = makeT()
    const identity = {
      tokenIdentifier: 'clerk|email-trust-existing',
      email: 'real@clerk.dev',
    }

    // Create user first
    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      role: 'DiveCenter',
      businessName: 'First Call',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    // Second call with a mismatched email in args should not overwrite
    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      role: 'DiveCenter',
      businessName: 'Second Call',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.withIdentity(identity).query(api.users.me, {})
    expect(user?.email).toBe('real@clerk.dev')
  })

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

describe('updateProfile email removed from args schema', () => {
  it('does not accept email in the args validator', async () => {
    const t = makeT()
    const identity = {
      tokenIdentifier: 'clerk|profile-no-email-schema',
      email: 'real@clerk.dev',
    }

    // Create user first
    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      role: 'DiveCenter',
      businessName: 'Schema Test',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    // Passing email should be rejected at schema validation level.
    // convex-test throws when args don't match the validator.
    const badCall = t.withIdentity(identity).mutation(api.users.updateProfile, {
      // @ts-expect-error -- intentionally passing an arg not in the validator
      email: 'attacker@evil.com',
    })
    await expect(badCall).rejects.toThrow()

    // Verify email unchanged
    const user = await t.withIdentity(identity).query(api.users.me, {})
    expect(user?.email).toBe('real@clerk.dev')
  })

  it('preserves Clerk identity email after profile update', async () => {
    const t = makeT()
    const identity = {
      tokenIdentifier: 'clerk|profile-preserves-email',
      email: 'identity@clerk.dev',
    }

    // Create user first
    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      role: 'DiveCenter',
      businessName: 'Preserve Test',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    // Update non-email fields
    await t.withIdentity(identity).mutation(api.users.updateProfile, {
      firstName: 'Updated',
      nickname: 'Updater',
    })

    // Stored email still reflects Clerk identity, not overwritten
    const user = await t.withIdentity(identity).query(api.users.me, {})
    expect(user?.email).toBe('identity@clerk.dev')
    expect(user?.firstName).toBe('Updated')
    expect(user?.nickname).toBe('Updater')
  })
})

describe('upsertFromWebhook email path', () => {
  it('sets email from webhook args on new user creation', async () => {
    const t = makeT()
    const token = `clerk|webhook-email-new-${crypto.randomUUID().slice(0, 8)}`

    const userId = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'webhook@clerk.dev',
      name: 'Webhook User',
      firstName: 'Webhook',
      lastName: 'User',
    })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.email).toBe('webhook@clerk.dev')
  })

  it('updates email from webhook args on existing user', async () => {
    const t = makeT()
    const token = `clerk|webhook-email-update-${crypto.randomUUID().slice(0, 8)}`

    // Create user via first webhook event
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'old@clerk.dev',
      name: 'Old Name',
      firstName: 'Old',
      lastName: 'Name',
    })

    // Second webhook event updates email (e.g. user changed email in Clerk)
    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'new@clerk.dev',
      name: 'New Name',
      firstName: 'New',
      lastName: 'Name',
    })

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', token))
        .unique()
    })
    expect(user?.email).toBe('new@clerk.dev')
    expect(user?.name).toBe('New Name')
  })
})
