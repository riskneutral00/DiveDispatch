import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'

const modules = import.meta.glob('../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

// ─── Seed helpers ──────────────────────────────────────────────────────────────

async function seedPortalFixture(
  ctx: Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0],
  token = 'test-token-abc123',
) {
  const bookingId = await ctx.db.insert('bookings', {
    ownerId: 'dc-test',
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: 43200000,
    paid: false,
    activityType: ['OW'],
    startDate: '2025-06-15',
    endDate: '2025-06-17',
    divers: [],
    operatorName: 'Test DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
  })

  await ctx.db.insert('bookingLinks', {
    bookingId,
    token,
    customerName: 'Test Customer',
    email: 'customer@test.com',
    expiresAt: Date.now() + 43200000,
  })

  const profileId = await ctx.db.insert('customerProfiles', {
    bookingId,
    linkToken: token,
  })

  return { bookingId, profileId, token }
}

// ─── saveSafetyInfo ────────────────────────────────────────────────────────────

describe('saveSafetyInfo', () => {
  it('1 — stores all fields', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx) => {
      return seedPortalFixture(ctx)
    })

    await t.mutation(api.customerProfiles.saveSafetyInfo, {
      token,
      bloodType: 'A+',
      allergies: 'penicillin',
      medications: 'aspirin',
      insurancePolicyNumber: 'POL-001',
    })

    await t.run(async (ctx) => {
      const profile = await ctx.db.get(profileId)
      expect(profile?.bloodType).toBe('A+')
      expect(profile?.allergies).toBe('penicillin')
      expect(profile?.medications).toBe('aspirin')
      expect(profile?.insurancePolicyNumber).toBe('POL-001')
    })
  })

  it('2 — accepts partial fields (only bloodType)', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx) => {
      return seedPortalFixture(ctx)
    })

    await t.mutation(api.customerProfiles.saveSafetyInfo, {
      token,
      bloodType: 'B-',
    })

    await t.run(async (ctx) => {
      const profile = await ctx.db.get(profileId)
      expect(profile?.bloodType).toBe('B-')
      expect(profile?.allergies).toBeUndefined()
      expect(profile?.medications).toBeUndefined()
      expect(profile?.insurancePolicyNumber).toBeUndefined()
    })
  })

  it('3 — accepts empty submission (no fields) without error', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx) => {
      return seedPortalFixture(ctx)
    })

    await expect(
      t.mutation(api.customerProfiles.saveSafetyInfo, { token }),
    ).resolves.not.toThrow()

    await t.run(async (ctx) => {
      const profile = await ctx.db.get(profileId)
      expect(profile?.bloodType).toBeUndefined()
      expect(profile?.allergies).toBeUndefined()
      expect(profile?.medications).toBeUndefined()
      expect(profile?.insurancePolicyNumber).toBeUndefined()
    })
  })

  it('4 — idempotent: second call overwrites first', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx) => {
      return seedPortalFixture(ctx)
    })

    await t.mutation(api.customerProfiles.saveSafetyInfo, {
      token,
      bloodType: 'O+',
      allergies: 'shellfish',
    })

    await t.mutation(api.customerProfiles.saveSafetyInfo, {
      token,
      bloodType: 'AB-',
      allergies: 'latex',
      medications: 'ibuprofen',
    })

    await t.run(async (ctx) => {
      const profile = await ctx.db.get(profileId)
      expect(profile?.bloodType).toBe('AB-')
      expect(profile?.allergies).toBe('latex')
      expect(profile?.medications).toBe('ibuprofen')
    })
  })

  it('5 — rejects invalid token', async () => {
    const t = makeT()

    await expect(
      t.mutation(api.customerProfiles.saveSafetyInfo, {
        token: 'non-existent-token',
        bloodType: 'O+',
      }),
    ).rejects.toThrow()
  })
})

// ─── getSafetyInfoByToken ──────────────────────────────────────────────────────

describe('getSafetyInfoByToken', () => {
  it('6 — returns empty strings for unsaved fields', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => {
      return seedPortalFixture(ctx)
    })

    const result = await t.query(api.customerProfiles.getSafetyInfoByToken, { token })
    expect(result).not.toBeNull()
    expect(result?.bloodType).toBe('')
    expect(result?.allergies).toBe('')
    expect(result?.medications).toBe('')
    expect(result?.insurancePolicyNumber).toBe('')
  })

  it('7 — returns saved values after saveSafetyInfo', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => {
      return seedPortalFixture(ctx)
    })

    await t.mutation(api.customerProfiles.saveSafetyInfo, {
      token,
      bloodType: 'O-',
      insurancePolicyNumber: 'INS-999',
    })

    const result = await t.query(api.customerProfiles.getSafetyInfoByToken, { token })
    expect(result?.bloodType).toBe('O-')
    expect(result?.insurancePolicyNumber).toBe('INS-999')
    expect(result?.allergies).toBe('')
    expect(result?.medications).toBe('')
  })

  it('8 — returns null for unknown token', async () => {
    const t = makeT()

    const result = await t.query(api.customerProfiles.getSafetyInfoByToken, {
      token: 'unknown-token',
    })
    expect(result).toBeNull()
  })
})
