import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'

const DEV_ISSUER = 'https://canonical-clerk.test'
const PROD_ISSUER = 'https://other-clerk.test'

describe('users.store mutation', () => {
  it('returns null when not authenticated', async () => {
    const t = makeT()
    const result = await t.mutation(api.users.store, {})
    expect(result).toBeNull()
  })

  it('returns the existing user._id when tokenIdentifier matches', async () => {
    const t = makeT()
    const tokenIdentifier = `${DEV_ISSUER}|user_match_${crypto.randomUUID().slice(0, 8)}`
    const userId = await t.run(async (ctx) =>
      ctx.db.insert('users', {
        tokenIdentifier,
        slug: 'matching-slug',
        email: 'match@test.com',
        firstName: 'Match',
        lastName: 'User',
        appLanguage: 'en',
      }),
    )

    const result = await t
      .withIdentity({ tokenIdentifier, email: 'match@test.com' })
      .mutation(api.users.store, {})

    expect(result).toBe(userId)
    const reloaded = await t.run(async (ctx) => ctx.db.get(userId))
    expect(reloaded?.tokenIdentifier).toBe(tokenIdentifier)
  })

  it('rebinds tokenIdentifier when email matches and issuer is the same Clerk instance', async () => {
    const t = makeT()
    const email = `rebind-${crypto.randomUUID().slice(0, 8)}@test.com`
    const oldToken = `${DEV_ISSUER}|user_old_${crypto.randomUUID().slice(0, 8)}`
    const newToken = `${DEV_ISSUER}|user_new_${crypto.randomUUID().slice(0, 8)}`

    const userId = await t.run(async (ctx) =>
      ctx.db.insert('users', {
        tokenIdentifier: oldToken,
        slug: 'rebind-slug',
        email,
        firstName: 'Old',
        lastName: 'Token',
        appLanguage: 'en',
      }),
    )

    const result = await t
      .withIdentity({ tokenIdentifier: newToken, email })
      .mutation(api.users.store, {})

    expect(result).toBe(userId)
    const reloaded = await t.run(async (ctx) => ctx.db.get(userId))
    expect(reloaded?.tokenIdentifier).toBe(newToken)

    const audit = await t.run(async (ctx) =>
      ctx.db.query('webhookAuditLog').withIndex('by_userId', (q) => q.eq('userId', userId)).collect(),
    )
    expect(audit).toHaveLength(1)
    expect(audit[0].eventType).toBe('user_rebind_via_auth')
    expect(audit[0].oldTokenIdentifier).toBe(oldToken)
    expect(audit[0].newTokenIdentifier).toBe(newToken)
  })

  it('rebinds a seed-bound user (non-Clerk issuer) to a real Clerk token', async () => {
    const t = makeT()
    const email = `seed-rebind-${crypto.randomUUID().slice(0, 8)}@test.com`
    const seedToken = `seed|seed-slug-${crypto.randomUUID().slice(0, 8)}`
    const newToken = `${DEV_ISSUER}|user_${crypto.randomUUID().slice(0, 8)}`

    const userId = await t.run(async (ctx) =>
      ctx.db.insert('users', {
        tokenIdentifier: seedToken,
        slug: 'seed-rebind-slug',
        email,
        firstName: 'Seed',
        lastName: 'User',
        appLanguage: 'en',
      }),
    )

    const result = await t
      .withIdentity({ tokenIdentifier: newToken, email })
      .mutation(api.users.store, {})

    expect(result).toBe(userId)
    const reloaded = await t.run(async (ctx) => ctx.db.get(userId))
    expect(reloaded?.tokenIdentifier).toBe(newToken)

    const audit = await t.run(async (ctx) =>
      ctx.db.query('webhookAuditLog').withIndex('by_userId', (q) => q.eq('userId', userId)).collect(),
    )
    expect(audit).toHaveLength(1)
    expect(audit[0].eventType).toBe('user_rebind_via_auth')
    expect(audit[0].oldIssuer).toBe('seed')
    expect(audit[0].newIssuer).toBe(DEV_ISSUER)
  })

  it('returns null when no row exists for token or email (sign-up path)', async () => {
    const t = makeT()
    const tokenIdentifier = `${DEV_ISSUER}|user_unknown_${crypto.randomUUID().slice(0, 8)}`
    const email = `unknown-${crypto.randomUUID().slice(0, 8)}@test.com`

    const result = await t
      .withIdentity({ tokenIdentifier, email })
      .mutation(api.users.store, {})

    expect(result).toBeNull()
  })

  it('returns null and audit-logs the rejection when a different Clerk issuer presents the same email', async () => {
    const t = makeT()
    const email = `cross-issuer-${crypto.randomUUID().slice(0, 8)}@test.com`
    const victimToken = `${DEV_ISSUER}|user_victim_${crypto.randomUUID().slice(0, 8)}`
    const attackerToken = `${PROD_ISSUER}|user_attacker_${crypto.randomUUID().slice(0, 8)}`

    const victimId = await t.run(async (ctx) =>
      ctx.db.insert('users', {
        tokenIdentifier: victimToken,
        slug: 'victim-slug',
        email,
        firstName: 'Vic',
        lastName: 'Tim',
        appLanguage: 'en',
      }),
    )

    const result = await t
      .withIdentity({ tokenIdentifier: attackerToken, email })
      .mutation(api.users.store, {})

    expect(result).toBeNull()
    const stillVictim = await t.run(async (ctx) => ctx.db.get(victimId))
    expect(stillVictim?.tokenIdentifier).toBe(victimToken)

    const audit = await t.run(async (ctx) =>
      ctx.db.query('webhookAuditLog').withIndex('by_userId', (q) => q.eq('userId', victimId)).collect(),
    )
    expect(audit).toHaveLength(1)
    expect(audit[0].eventType).toBe('user_rebind_rejected')
  })

  it('does not create a duplicate row for the same email when a stale token row already exists', async () => {
    const t = makeT()
    const email = `no-dup-${crypto.randomUUID().slice(0, 8)}@test.com`
    const oldToken = `${DEV_ISSUER}|user_old_${crypto.randomUUID().slice(0, 8)}`
    const newToken = `${DEV_ISSUER}|user_new_${crypto.randomUUID().slice(0, 8)}`

    const originalId = await t.run(async (ctx) =>
      ctx.db.insert('users', {
        tokenIdentifier: oldToken,
        slug: 'no-dup-slug',
        email,
        firstName: 'A',
        lastName: 'B',
        appLanguage: 'en',
      }),
    )

    await t.withIdentity({ tokenIdentifier: newToken, email }).mutation(api.users.store, {})

    const all = await t.run(async (ctx) =>
      ctx.db.query('users').withIndex('by_email', (q) => q.eq('email', email)).collect(),
    )
    expect(all).toHaveLength(1)
    expect(all[0]._id).toBe(originalId)
    expect(all[0].tokenIdentifier).toBe(newToken)
  })
})

describe('createUser email-rebind safety', () => {
  it('rebinds existing row instead of inserting a duplicate when email matches and issuer is allowed', async () => {
    const t = makeT()
    const email = `createuser-rebind-${crypto.randomUUID().slice(0, 8)}@test.com`
    const oldToken = `${DEV_ISSUER}|user_old_${crypto.randomUUID().slice(0, 8)}`
    const newToken = `${DEV_ISSUER}|user_new_${crypto.randomUUID().slice(0, 8)}`

    const originalId = await t.run(async (ctx) =>
      ctx.db.insert('users', {
        tokenIdentifier: oldToken,
        slug: 'createuser-rebind-slug',
        email,
        firstName: 'Old',
        lastName: 'Profile',
        appLanguage: 'en',
      }),
    )

    const resultId = await t
      .withIdentity({ tokenIdentifier: newToken, email })
      .mutation(api.users.createUser, {
        role: 'Compressor',
        firstName: 'New',
        lastName: 'Profile',
        dateOfBirth: '1990-01-01',
        tcAccepted: true,
        tcVersion: '1.0',
      })

    expect(resultId).toBe(originalId)
    const all = await t.run(async (ctx) =>
      ctx.db.query('users').withIndex('by_email', (q) => q.eq('email', email)).collect(),
    )
    expect(all).toHaveLength(1)
    expect(all[0].tokenIdentifier).toBe(newToken)
    expect(all[0].firstName).toBe('New')
  })
})
