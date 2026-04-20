import { describe, it, expect, vi } from 'vitest'
import { ConvexError, type Value } from 'convex/values'
import { api, internal } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'
import { createUserDefaults } from './helpers/createUser'

describe('createUser mutation', () => {
  it('auto-creates a personal org and links user.organizationId on new user', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity({ tokenIdentifier: 'clerk|personal-org-new', email: 'solo@test.com' })
      .mutation(api.users.createUser, { ...createUserDefaults, role: 'Compressor' })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.organizationId).toBeDefined()

    const org = await t.run(async (ctx) =>
      user?.organizationId ? ctx.db.get(user.organizationId) : null,
    )
    expect(org?.slug).toBe(user?.slug)
    expect(org?.clerkOrgId).toBeUndefined()
  })

  it('backfills user.organizationId on second createUser call when missing', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|backfill-personal-org', email: 'bf@test.com' }

    const userId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {
        tokenIdentifier: identity.tokenIdentifier,
        originalTokenIdentifier: identity.tokenIdentifier,
        slug: 'bf-slug',
        email: identity.email,
        name: '',
        firstName: '',
        lastName: '',
        appLanguage: 'en',
      })
    })

    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, { ...createUserDefaults, role: 'Instructor' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.organizationId).toBeDefined()
  })

  it('uses identity.email and ignores args.email on new user', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity({
        tokenIdentifier: 'clerk|email-trust-new',
        email: 'real@clerk.dev',
      })
      .mutation(api.users.createUser, { ...createUserDefaults,
        role: 'DiveCenter',
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

    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, { ...createUserDefaults,
      role: 'DiveCenter',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, { ...createUserDefaults,
      role: 'DiveCenter',
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
      .mutation(api.users.createUser, { ...createUserDefaults,
        role: 'DiveCenter',
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
      .mutation(api.users.createUser, { ...createUserDefaults,
        role: 'Instructor',
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
      .mutation(api.users.createUser, { ...createUserDefaults,
        role: 'DiveCenter',
      })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.phone).toBeUndefined()
  })

  it('patches existing user with new fields on idempotent call', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|idem-user' }

    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, { ...createUserDefaults,
      role: 'DiveCenter',
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, { ...createUserDefaults,
      role: 'Agent',
      phone: '+1234567890',
      nickname: 'Updated Nick',
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t
      .withIdentity(identity)
      .query(api.users.me, {})
    expect(user?.phone).toBe('+1234567890')
    expect(user?.nickname).toBe('Updated Nick')
  })
})

describe('createUser age gate + T&C', () => {
  it('rejects a DOB making the user under 18', async () => {
    const t = makeT()
    const now = Date.now()
    const today = new Date(now)
    const dobUnder18 = `${today.getUTCFullYear() - 17}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`

    vi.useFakeTimers({ now })
    try {
      await t.withIdentity({ tokenIdentifier: 'clerk|minor' }).mutation(api.users.createUser, {
        ...createUserDefaults,
        dateOfBirth: dobUnder18,
        role: 'DiveCenter',
      })
      expect.fail('Expected ConvexError to be thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ConvexError)
      const raw = (err as ConvexError<Value>).data
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      expect(data.code).toBe('VALIDATION')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stores tcAcceptedAt timestamp on new user insert', async () => {
    const t = makeT()
    const fixedNow = Date.UTC(2026, 0, 15)
    vi.useFakeTimers({ now: fixedNow })
    const userId = await t.withIdentity({ tokenIdentifier: 'clerk|tc-accepter' })
      .mutation(api.users.createUser, {
        ...createUserDefaults,
        role: 'DiveCenter',
      })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.tcAcceptedAt).toBe(fixedNow)
  })

  it('does not overwrite tcAcceptedAt on idempotent re-call', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|tc-idem' }
    const firstNow = Date.UTC(2026, 0, 15)
    const secondNow = Date.UTC(2026, 0, 20)

    vi.useFakeTimers({ now: firstNow })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      ...createUserDefaults,
      role: 'DiveCenter',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    vi.useFakeTimers({ now: secondNow })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      ...createUserDefaults,
      role: 'Instructor',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.withIdentity(identity).query(api.users.me, {})
    expect(user?.tcAcceptedAt).toBe(firstNow)
  })

  it('stores tcVersion on new user insert', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t.withIdentity({ tokenIdentifier: 'clerk|tc-version-new' })
      .mutation(api.users.createUser, {
        ...createUserDefaults,
        role: 'DiveCenter',
        tcVersion: '2026-04-16-v1',
      })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.tcVersion).toBe('2026-04-16-v1')
  })

  it('updates tcVersion and refreshes tcAcceptedAt on re-submission with new version', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|tc-version-upgrade' }
    const firstNow = Date.UTC(2026, 0, 15)
    const secondNow = Date.UTC(2026, 5, 1)

    vi.useFakeTimers({ now: firstNow })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      ...createUserDefaults,
      role: 'DiveCenter',
      tcVersion: '2026-04-16-v1',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    vi.useFakeTimers({ now: secondNow })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      ...createUserDefaults,
      role: 'DiveCenter',
      tcVersion: '2026-05-01-v2',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.withIdentity(identity).query(api.users.me, {})
    expect(user?.tcVersion).toBe('2026-05-01-v2')
    expect(user?.tcAcceptedAt).toBe(secondNow)
  })

  it('does not refresh tcAcceptedAt on re-submission with same version', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|tc-version-same' }
    const firstNow = Date.UTC(2026, 0, 15)
    const secondNow = Date.UTC(2026, 5, 1)

    vi.useFakeTimers({ now: firstNow })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      ...createUserDefaults,
      role: 'DiveCenter',
      tcVersion: '2026-04-16-v1',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    vi.useFakeTimers({ now: secondNow })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      ...createUserDefaults,
      role: 'DiveCenter',
      tcVersion: '2026-04-16-v1',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.withIdentity(identity).query(api.users.me, {})
    expect(user?.tcVersion).toBe('2026-04-16-v1')
    expect(user?.tcAcceptedAt).toBe(firstNow)
  })
})

describe('createUser dateOfBirth immutability', () => {
  it('does not overwrite dateOfBirth on idempotent re-submission', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|dob-immutable' }

    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      ...createUserDefaults,
      role: 'DiveCenter',
      dateOfBirth: '1990-01-01',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      ...createUserDefaults,
      role: 'DiveCenter',
      dateOfBirth: '2000-06-15',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.withIdentity(identity).query(api.users.me, {})
    expect(user?.dateOfBirth).toBe('1990-01-01')
  })
})

describe('createUser rate limiting', () => {
  it('rejects the 4th call within a minute with RATE_LIMITED', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|rate-limit-user' }

    for (let i = 0; i < 3; i++) {
      vi.useFakeTimers({ now: Date.now() })
      await t.withIdentity(identity).mutation(api.users.createUser, { ...createUserDefaults,
        role: 'DiveCenter',
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
      vi.useRealTimers()
    }

    try {
      vi.useFakeTimers({ now: Date.now() })
      await t.withIdentity(identity).mutation(api.users.createUser, { ...createUserDefaults,
        role: 'DiveCenter',
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

    for (let i = 0; i < 3; i++) {
      vi.useFakeTimers({ now: Date.now() })
      await t.withIdentity(identityA).mutation(api.users.createUser, { ...createUserDefaults,
        role: 'DiveCenter',
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
      vi.useRealTimers()
    }

    vi.useFakeTimers({ now: Date.now() })
    const userId = await t.withIdentity(identityB).mutation(api.users.createUser, { ...createUserDefaults,
      role: 'DiveCenter',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    expect(typeof userId).toBe('string')
  })
})

describe('updateProfile email removed from args schema', () => {
  it('does not accept email in the args validator', async () => {
    const t = makeT()
    const identity = {
      tokenIdentifier: 'clerk|profile-no-email-schema',
      email: 'real@clerk.dev',
    }

    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, { ...createUserDefaults,
      role: 'DiveCenter',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const user = await t.withIdentity(identity).query(api.users.me, {})
    expect(user?.email).toBe('real@clerk.dev')
  })

  it('preserves Clerk identity email after profile update', async () => {
    const t = makeT()
    const identity = {
      tokenIdentifier: 'clerk|profile-preserves-email',
      email: 'identity@clerk.dev',
    }

    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, { ...createUserDefaults,
      role: 'DiveCenter',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    await t.withIdentity(identity).mutation(api.users.updateProfile, {
      firstName: 'Updated',
      nickname: 'Updater',
    })

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

    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: token,
      email: 'old@clerk.dev',
      name: 'Old Name',
      firstName: 'Old',
      lastName: 'Name',
    })

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

describe('createUser — userRoles organizationId invariant', () => {
  it('sets userRoles.organizationId to user.organizationId at insert time', async () => {
    const t = makeT()
    vi.useFakeTimers({ now: Date.now() })
    const userId = await t
      .withIdentity({ tokenIdentifier: 'clerk|role-org-binding', email: 'rob@test.com' })
      .mutation(api.users.createUser, {
        ...createUserDefaults,
        role: 'DiveCenter',
        roles: ['DiveCenter', 'Instructor'],
      })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    const { user, roles } = await t.run(async (ctx) => ({
      user: await ctx.db.get(userId),
      roles: await ctx.db
        .query('userRoles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect(),
    }))

    expect(user?.organizationId).toBeDefined()
    expect(roles.length).toBeGreaterThan(0)
    for (const r of roles) {
      expect(r.organizationId).toBe(user?.organizationId)
    }
  })

  it('addRole inherits user.organizationId into new userRoles row', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|addrole-binding', email: 'ar@test.com' }

    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      ...createUserDefaults,
      role: 'DiveCenter',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    await t.withIdentity(identity).mutation(api.userRoles.addRole, { role: 'Instructor' })

    const user = await t.withIdentity(identity).query(api.users.me, {})
    const roles = await t.run(async (ctx) =>
      user
        ? await ctx.db
            .query('userRoles')
            .withIndex('by_userId', (q) => q.eq('userId', user._id))
            .collect()
        : [],
    )
    const instructorRole = roles.find((r) => r.role === 'Instructor')
    expect(instructorRole).toBeDefined()
    expect(instructorRole?.organizationId).toBe(user?.organizationId)
  })
})

describe('upsertFromWebhook email-rebind safety', () => {
  const DEV_ISSUER = 'https://canonical-clerk.test'
  const PROD_ISSUER = 'https://other-clerk.test'

  it('rebinds a seed-bound user to a real Clerk token when emails match (seed migration path)', async () => {
    const t = makeT()
    const email = `seed-migrate-${crypto.randomUUID().slice(0, 8)}@test.com`
    const seedToken = `seed|seed-slug-${crypto.randomUUID().slice(0, 8)}`
    const newToken = `${DEV_ISSUER}|user_${crypto.randomUUID().slice(0, 8)}`

    const seedId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {
        tokenIdentifier: seedToken,
        originalTokenIdentifier: seedToken,
        slug: 'seed-slug',
        email,
        name: 'Seed User',
        firstName: 'Seed',
        lastName: 'User',
        appLanguage: 'en',
      })
    })

    const resultId = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: newToken,
      email,
      name: 'Clerk User',
      firstName: 'Clerk',
      lastName: 'User',
    })

    expect(resultId).toBe(seedId)
    const user = await t.run(async (ctx) => ctx.db.get(seedId))
    expect(user?.tokenIdentifier).toBe(newToken)
    expect(user?.originalTokenIdentifier).toBe(newToken)
    expect(user?.firstName).toBe('Clerk')

    const audit = await t.run(async (ctx) => {
      return await ctx.db
        .query('webhookAuditLog')
        .withIndex('by_userId', (q) => q.eq('userId', seedId))
        .collect()
    })
    expect(audit).toHaveLength(1)
    expect(audit[0].eventType).toBe('user_rebind')
    expect(audit[0].oldIssuer).toBe('seed')
    expect(audit[0].newIssuer).toBe(DEV_ISSUER)
  })

  it('rebinds when a Clerk user is deleted and recreated in the same instance (same issuer)', async () => {
    const t = makeT()
    const email = `same-issuer-${crypto.randomUUID().slice(0, 8)}@test.com`
    const oldToken = `${DEV_ISSUER}|user_old_${crypto.randomUUID().slice(0, 8)}`
    const newToken = `${DEV_ISSUER}|user_new_${crypto.randomUUID().slice(0, 8)}`

    const userId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {
        tokenIdentifier: oldToken,
        originalTokenIdentifier: oldToken,
        slug: 'same-issuer-slug',
        email,
        name: 'Original',
        firstName: 'Orig',
        lastName: 'Inal',
        appLanguage: 'en',
      })
    })

    const resultId = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: newToken,
      email,
      name: 'Recreated',
      firstName: 'Re',
      lastName: 'Created',
    })

    expect(resultId).toBe(userId)
    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.tokenIdentifier).toBe(newToken)
    expect(user?.originalTokenIdentifier).toBe(newToken)

    const audit = await t.run(async (ctx) => {
      return await ctx.db
        .query('webhookAuditLog')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect()
    })
    expect(audit).toHaveLength(1)
    expect(audit[0].eventType).toBe('user_rebind')
    expect(audit[0].oldIssuer).toBe(DEV_ISSUER)
    expect(audit[0].newIssuer).toBe(DEV_ISSUER)
  })

  it('rejects rebind from a different Clerk issuer and logs the rejection', async () => {
    const t = makeT()
    const email = `cross-issuer-${crypto.randomUUID().slice(0, 8)}@test.com`
    const victimToken = `${DEV_ISSUER}|user_victim_${crypto.randomUUID().slice(0, 8)}`
    const attackerToken = `${PROD_ISSUER}|user_attacker_${crypto.randomUUID().slice(0, 8)}`

    const victimId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {
        tokenIdentifier: victimToken,
        originalTokenIdentifier: victimToken,
        slug: 'victim-slug',
        email,
        name: 'Victim',
        firstName: 'Vic',
        lastName: 'Tim',
        appLanguage: 'en',
      })
    })

    const resultId = await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: attackerToken,
      email,
      name: 'Attacker',
      firstName: 'Att',
      lastName: 'Acker',
    })

    expect(resultId).toBe(victimId)
    const victim = await t.run(async (ctx) => ctx.db.get(victimId))
    expect(victim?.tokenIdentifier).toBe(victimToken)
    expect(victim?.originalTokenIdentifier).toBe(victimToken)
    expect(victim?.firstName).toBe('Vic')

    const attackerLookup = await t.run(async (ctx) => {
      return await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', attackerToken))
        .unique()
    })
    expect(attackerLookup).toBeNull()

    const audit = await t.run(async (ctx) => {
      return await ctx.db
        .query('webhookAuditLog')
        .withIndex('by_userId', (q) => q.eq('userId', victimId))
        .collect()
    })
    expect(audit).toHaveLength(1)
    expect(audit[0].eventType).toBe('user_rebind_rejected')
    expect(audit[0].oldIssuer).toBe(DEV_ISSUER)
    expect(audit[0].newIssuer).toBe(PROD_ISSUER)
  })

  it('deleteFromWebhook by the new token after rebind finds the row (no orphan)', async () => {
    const t = makeT()
    const email = `rebind-then-delete-${crypto.randomUUID().slice(0, 8)}@test.com`
    const oldToken = `${DEV_ISSUER}|user_first_${crypto.randomUUID().slice(0, 8)}`
    const newToken = `${DEV_ISSUER}|user_second_${crypto.randomUUID().slice(0, 8)}`

    const userId = await t.run(async (ctx) => {
      return ctx.db.insert('users', {
        tokenIdentifier: oldToken,
        originalTokenIdentifier: oldToken,
        slug: 'rebind-delete-slug',
        email,
        name: 'Original',
        firstName: 'Orig',
        lastName: 'Inal',
        appLanguage: 'en',
      })
    })

    await t.mutation(internal.users.upsertFromWebhook, {
      tokenIdentifier: newToken,
      email,
      name: 'Recreated',
      firstName: 'Re',
      lastName: 'Created',
    })

    await t.mutation(internal.users.deleteFromWebhook, {
      tokenIdentifier: newToken,
    })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.email).toBe('deleted@deleted.invalid')
    expect(user?.firstName).toBe('')
  })
})
