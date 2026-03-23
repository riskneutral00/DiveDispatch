import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import type { Doc } from '../convex/_generated/dataModel'

const modules = import.meta.glob('../convex/**/*.ts')

// ─── Seed helpers ─────────────────────────────────────────────────────────────

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedUser(ctx: Ctx, slug: string, role: string = 'Agent') {
  return ctx.db.insert('users', {
    tokenIdentifier: `clerk|${slug}`,
    slug,
    email: `${slug}@test.com`,
    name: `${slug} Display`,
    firstName: slug,
    lastName: 'Test',
    businessName: 'Test Biz',
    role: role as any,
    isSeeded: false,
    preferredLocale: 'en',
  })
}

const VALID_AGENT_ARGS = {
  name: 'Test Agent',
  locations: [{ placeName: 'Koh Tao', country: 'Thailand', lat: 10.09, lng: 99.84 }],
  contactEmail: 'agent@test.com',
  contactPhone: '+66123456789',
  associations: [{ agency: 'PADI', number: '12345' }],
  focusedLanguages: ['en'],
  defaultReferralMode: 'independent' as const,
}

// ─── agents.create ───────────────────────────────────────────────────────────

describe('agents.create', () => {
  it('rejects unauthenticated callers with UNAUTHENTICATED', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(api.agents.create, VALID_AGENT_ARGS),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-Agent roles with FORBIDDEN', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-user', 'DiveCenter')
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|dc-user' })
        .mutation(api.agents.create, VALID_AGENT_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates agent profile for Agent user', async () => {
    const t = convexTest(schema, modules)
    let userId: any
    await t.run(async (ctx) => {
      userId = await seedUser(ctx, 'new-agent', 'Agent')
    })

    const agentId = await t.withIdentity({ tokenIdentifier: 'clerk|new-agent' })
      .mutation(api.agents.create, VALID_AGENT_ARGS)

    expect(agentId).toBeTruthy()

    await t.run(async (ctx) => {
      const agent = await ctx.db.get(agentId as any) as Doc<'agents'> | null
      expect(agent).toBeTruthy()
      expect(agent!.name).toBe('Test Agent')
      expect(agent!.userId).toEqual(userId)
      expect(agent!.verified).toBe(false)
      expect(agent!.defaultReferralMode).toBe('independent')
      expect(agent!.locations).toHaveLength(1)
      expect(agent!.locations[0].placeName).toBe('Koh Tao')
    })
  })

  it('returns existing agent ID on duplicate create (idempotent)', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dup-agent', 'Agent')
    })

    const id1 = await t.withIdentity({ tokenIdentifier: 'clerk|dup-agent' })
      .mutation(api.agents.create, VALID_AGENT_ARGS)

    const id2 = await t.withIdentity({ tokenIdentifier: 'clerk|dup-agent' })
      .mutation(api.agents.create, {
        ...VALID_AGENT_ARGS,
        name: 'Different Name',
      })

    expect(id1).toBe(id2)
  })
})

// ─── agents.update ───────────────────────────────────────────────────────────

describe('agents.update', () => {
  it('rejects unauthenticated callers with UNAUTHENTICATED', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(api.agents.update, { name: 'New Name' }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when no agent profile exists with NOT_FOUND', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'no-profile', 'Agent')
    })

    await expect(
      t.withIdentity({ tokenIdentifier: 'clerk|no-profile' })
        .mutation(api.agents.update, { name: 'New Name' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('updates agent profile fields', async () => {
    const t = convexTest(schema, modules)
    let agentId: any
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'upd-agent', 'Agent')
      agentId = await ctx.db.insert('agents', {
        ...VALID_AGENT_ARGS,
        userId,
        verified: false,
      } as any)
    })

    await t.withIdentity({ tokenIdentifier: 'clerk|upd-agent' })
      .mutation(api.agents.update, {
        name: 'Updated Agent',
        defaultReferralMode: 'referral',
      })

    await t.run(async (ctx) => {
      const agent = await ctx.db.get(agentId) as Doc<'agents'> | null
      expect(agent!.name).toBe('Updated Agent')
      expect(agent!.defaultReferralMode).toBe('referral')
      // Unchanged fields preserved
      expect(agent!.contactEmail).toBe('agent@test.com')
    })
  })
})

// ─── agents.mine ─────────────────────────────────────────────────────────────

describe('agents.mine', () => {
  it('returns null for unauthenticated callers', async () => {
    const t = convexTest(schema, modules)

    const result = await t.query(api.agents.mine, {})
    expect(result).toBeNull()
  })

  it('returns null when no agent profile exists', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await seedUser(ctx, 'no-agent-profile', 'Agent')
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|no-agent-profile' })
      .query(api.agents.mine, {})
    expect(result).toBeNull()
  })

  it('returns agent profile with normalized location fields', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'my-agent', 'Agent')
      await ctx.db.insert('agents', {
        ...VALID_AGENT_ARGS,
        userId,
        verified: false,
      } as any)
    })

    const result = await t.withIdentity({ tokenIdentifier: 'clerk|my-agent' })
      .query(api.agents.mine, {})

    expect(result).toBeTruthy()
    expect(result!.name).toBe('Test Agent')
    // Normalized flat fields from locations[0]
    expect(result!.placeName).toBe('Koh Tao')
    expect(result!.country).toBe('Thailand')
  })
})
