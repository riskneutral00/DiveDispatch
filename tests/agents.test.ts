import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import { seedUserWithOrg as seedUser, seedAgent } from './fixtures'
import { makeT, orgIdentityFor } from './helpers/convex-helpers'

const VALID_AGENT_ARGS = {
  name: 'Test Agent',
  address: { city: 'Koh Tao', country: 'TH' },
  lat: 10.09,
  lng: 99.84,
  email: 'agent@test.com',
  phone: '+66123456789',
  associations: [{ agency: 'PADI', number: '12345' }],
}

// ─── agents.create ───────────────────────────────────────────────────────────

describe('agents.create', () => {
  it('rejects unauthenticated callers with UNAUTHENTICATED', async () => {
    const t = makeT()

    await expect(
      t.mutation(api.agents.create, VALID_AGENT_ARGS),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects non-Agent roles with FORBIDDEN', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dc-user', 'DiveCenter')
    })

    await expect(
      t.withIdentity(orgIdentityFor('dc-user'))
        .mutation(api.agents.create, VALID_AGENT_ARGS),
    ).rejects.toThrow(/FORBIDDEN/)
  })

  it('creates agent profile for Agent user', async () => {
    const t = makeT()
    let userId: Awaited<ReturnType<typeof seedUser>> | undefined
    await t.run(async (ctx) => {
      userId = await seedUser(ctx, 'new-agent', 'Agent')
    })

    const agentId = await t.withIdentity(orgIdentityFor('new-agent'))
      .mutation(api.agents.create, VALID_AGENT_ARGS)

    expect(typeof agentId).toBe('string')

    await t.run(async (ctx) => {
      const agent = await ctx.db.get(agentId as Id<'agents'>) as Doc<'agents'> | null
      expect(agent).not.toBeNull()
      expect(agent!.name).toBe('Test Agent')
      expect(agent!.organizationId).toBeDefined()
      expect(agent!.verified).toBe(false)
      expect(agent!.address.city).toBe('Koh Tao')
      expect(agent!.address.country).toBe('TH')
    })
  })

  it('returns existing agent ID on duplicate create (idempotent)', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'dup-agent', 'Agent')
    })

    const id1 = await t.withIdentity(orgIdentityFor('dup-agent'))
      .mutation(api.agents.create, VALID_AGENT_ARGS)

    const id2 = await t.withIdentity(orgIdentityFor('dup-agent'))
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
    const t = makeT()

    await expect(
      t.mutation(api.agents.update, { name: 'New Name' }),
    ).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('rejects when no agent profile exists with NOT_FOUND', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'no-profile', 'Agent')
    })

    await expect(
      t.withIdentity(orgIdentityFor('no-profile'))
        .mutation(api.agents.update, { name: 'New Name' }),
    ).rejects.toThrow(/NOT_FOUND/)
  })

  it('updates agent profile fields', async () => {
    const t = makeT()
    let agentId: Awaited<ReturnType<typeof seedAgent>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'upd-agent', 'Agent')
      agentId = await seedAgent(ctx, userId)
    })

    await t.withIdentity(orgIdentityFor('upd-agent'))
      .mutation(api.agents.update, {
        name: 'Updated Agent',
      })

    await t.run(async (ctx) => {
      const agent = await ctx.db.get(agentId!) as Doc<'agents'> | null
      expect(agent!.name).toBe('Updated Agent')
      expect(agent!.email).toBe('agent@test.com')
    })
  })

  it('persists isAllowed (whitelist) via update mutation', async () => {
    const t = makeT()
    let agentId: Awaited<ReturnType<typeof seedAgent>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'wl-agent', 'Agent')
      agentId = await seedAgent(ctx, userId)
    })

    await t.withIdentity(orgIdentityFor('wl-agent'))
      .mutation(api.agents.update, {
        isAllowed: ['dc-one', 'dc-two'],
        notAllowed: [],
      })

    await t.run(async (ctx) => {
      const agent = await ctx.db.get(agentId!) as Doc<'agents'> | null
      expect(agent!.isAllowed).toEqual(['dc-one', 'dc-two'])
      expect(agent!.notAllowed).toEqual([])
    })
  })

  it('persists notAllowed (blocklist) via update mutation', async () => {
    const t = makeT()
    let agentId: Awaited<ReturnType<typeof seedAgent>> | undefined
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'bl-agent', 'Agent')
      agentId = await seedAgent(ctx, userId)
    })

    await t.withIdentity(orgIdentityFor('bl-agent'))
      .mutation(api.agents.update, {
        isAllowed: [],
        notAllowed: ['bad-dc'],
      })

    await t.run(async (ctx) => {
      const agent = await ctx.db.get(agentId!) as Doc<'agents'> | null
      expect(agent!.isAllowed).toEqual([])
      expect(agent!.notAllowed).toEqual(['bad-dc'])
    })
  })
})

// ─── agents.mine ─────────────────────────────────────────────────────────────

describe('agents.mine', () => {
  it('returns null for unauthenticated callers', async () => {
    const t = makeT()

    const result = await t.query(api.agents.mine, {})
    expect(result).toBeNull()
  })

  it('returns null when no agent profile exists', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      await seedUser(ctx, 'no-agent-profile', 'Agent')
    })

    const result = await t.withIdentity(orgIdentityFor('no-agent-profile'))
      .query(api.agents.mine, {})
    expect(result).toBeNull()
  })

  it('returns agent profile with normalized location fields', async () => {
    const t = makeT()
    await t.run(async (ctx) => {
      const userId = await seedUser(ctx, 'my-agent', 'Agent')
      await seedAgent(ctx, userId)
    })

    const result = await t.withIdentity(orgIdentityFor('my-agent'))
      .query(api.agents.mine, {})

    expect(result).not.toBeNull()
    expect(result!.name).toBe('Test Agent')
    expect(result!.address.city).toBe('Koh Tao')
    expect(result!.address.country).toBe('TH')
  })
})
