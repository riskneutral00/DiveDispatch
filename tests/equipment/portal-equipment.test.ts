import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { makeT, expectConvexError } from '../helpers/convex-helpers'
import { seedUser, seedPortalFixture, TEST_SLUGS, TEST_TOKENS } from '../fixtures'
import { passportExpiry, dob } from '../helpers/dates'
import type { Id } from '../../convex/_generated/dataModel'

function customerFields(overrides: Record<string, unknown> = {}) {
  return {
    legalFirstName: 'Alice',
    legalLastName: 'Diver',
    email: 'alice@example.com',
    phone: '+66123456789',
    nationality: 'GB',
    dateOfBirth: dob(25),
    passportNumber: 'AB123456',
    passportIssuingCountry: 'GB',
    passportExpirationDate: passportExpiry(5),
    gender: 'F' as const,
    emergencyContactName: 'Bob Diver',
    emergencyContactPhone: '+66987654321',
    emergencyContactRelation: 'Spouse',
    createdAt: Date.now(),
    ...overrides,
  }
}

async function setupPortal(t: ReturnType<typeof makeT>) {
  let token = ''
  let customerId: Id<'customers'> | undefined

  await t.run(async (ctx) => {
    await seedUser(ctx, {
      tokenIdentifier: TEST_TOKENS.diveCenter,
      slug: TEST_SLUGS.diveCenter,
      role: 'DiveCenter',
    })

    const cId = await ctx.db.insert('customers', customerFields())
    customerId = cId

    const fixture = await seedPortalFixture(ctx, {
      profile: { customerId: cId },
    })
    token = fixture.token
  })

  return { token, customerId: customerId! }
}

describe('portalDraft.saveEquipmentData', () => {
  it('saves body measurements to customers table', async () => {
    const t = makeT()
    const { token, customerId } = await setupPortal(t)

    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      heightCm: 175,
      weightKg: 70,
      shoeSize: 42,
      shoeSizeUnit: 'EU',
    })

    const customer = await t.run(async (ctx) => ctx.db.get(customerId))
    expect(customer!.heightCm).toBe(175)
    expect(customer!.weightKg).toBe(70)
    expect(customer!.shoeSize).toBe(42)
    expect(customer!.shoeSizeUnit).toBe('EU')
  })

  it('saves prescription info to customers table', async () => {
    const t = makeT()
    const { token, customerId } = await setupPortal(t)

    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      needsPoweredLenses: true,
      prescriptionStrength: '-2.5',
    })

    const customer = await t.run(async (ctx) => ctx.db.get(customerId))
    expect(customer!.needsPoweredLenses).toBe(true)
    expect(customer!.prescriptionStrength).toBe('-2.5')
  })

  it('saves rental checklist to customerProfiles', async () => {
    const t = makeT()
    const { token } = await setupPortal(t)

    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      heightCm: 170,
      weightKg: 65,
      shoeSize: 40,
      shoeSizeUnit: 'EU',
      rentalChecklist: {
        mask: 'rent',
        bcd: 'rent',
        wetsuit: 'rent',
        fins: 'rent',
        regulator: 'own',
      },
    })

    const profiles = await t.run(async (ctx) =>
      ctx.db.query('customerProfiles').collect(),
    )
    const profile = profiles[0]
    expect(profile.rentalChecklist).toMatchObject({
      mask: 'rent',
      bcd: 'rent',
      wetsuit: 'rent',
      fins: 'rent',
      regulator: 'own',
    })
  })

  it('rejects heightCm out of range', async () => {
    const t = makeT()
    const { token } = await setupPortal(t)

    await expectConvexError(
      t.mutation(api.portalDraft.saveEquipmentData, {
        token,
        heightCm: 300,
      }),
      'VALIDATION',
    )
  })

  it('requires height when renting equipment', async () => {
    const t = makeT()
    const { token } = await setupPortal(t)

    await expectConvexError(
      t.mutation(api.portalDraft.saveEquipmentData, {
        token,
        weightKg: 70,
        rentalChecklist: {
          mask: 'rent',
          bcd: 'own',
          wetsuit: 'own',
          fins: 'own',
          regulator: 'own',
        },
      }),
      'VALIDATION',
    )
  })

  it('requires shoe size when renting fins', async () => {
    const t = makeT()
    const { token } = await setupPortal(t)

    await expectConvexError(
      t.mutation(api.portalDraft.saveEquipmentData, {
        token,
        heightCm: 170,
        weightKg: 70,
        rentalChecklist: {
          mask: 'own',
          bcd: 'own',
          wetsuit: 'own',
          fins: 'rent',
          regulator: 'own',
        },
      }),
      'VALIDATION',
    )
  })
})
