import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import { testDate, testToken } from '../helpers/dates'

// ─── Setup ────────────────────────────────────────────────────────────────────

const HOLD_TTL = 43_200_000
const modules = import.meta.glob('../../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

async function seedPortalFixture(ctx: Ctx) {
  const bookingId = await ctx.db.insert('bookings', {
    ownerId: 'dc-equip-test',
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['DSD'],
    startDate: testDate(5),
    endDate: testDate(5),
    divers: [
      {
        name: 'Carlos',
        abbrev: 'C',
        flag: { code: 'MX', label: 'Mexico' },
        startDate: testDate(5),
        endDate: testDate(5),
        activityType: ['DSD'],
      },
    ],
    operatorName: 'Equip DC',
    portalContact: false,
    portalMedical: false,
    portalWaiver: false,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    expiresAt: Date.now() + HOLD_TTL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const token = testToken('tok-equip')
  await ctx.db.insert('bookingLinks', {
    bookingId,
    token,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    customerName: 'Carlos Diver',
    email: 'carlos@example.com',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const profileId = await ctx.db.insert('customerProfiles', {
    bookingId,
    linkToken: token,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  return { bookingId, token, profileId }
}

/** Seed a customer record and link it to the profile (contact step complete). */
async function seedCustomerForProfile(ctx: Ctx, profileId: Awaited<ReturnType<typeof seedPortalFixture>>['profileId']) {
  const customerId = await ctx.db.insert('customers', {
    legalFirstName: 'Carlos',
    legalLastName: 'Diver',
    email: 'carlos@example.com',
    phone: '+52 555 123 4567',
    dateOfBirth: '1992-04-10',
    gender: 'M',
    nationality: 'Mexico',
    passportNumber: 'MX9876543',
    passportIssuingCountry: 'Mexico',
    passportExpirationDate: '2029-04-10',
    emergencyContactName: 'Maria Diver',
    emergencyContactPhone: '+52 555 765 4321',
    emergencyContactRelation: 'Sibling',
    createdAt: Date.now(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  await ctx.db.patch(profileId, { customerId })
  return customerId
}

// ─── saveEquipmentData ────────────────────────────────────────────────────────

describe('saveEquipmentData', () => {
  it('saves sizing data to customer record', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      await seedCustomerForProfile(ctx, fixture.profileId)
      return fixture
    })

    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      heightCm: 178,
      weightKg: 75,
      shoeSize: 42,
      shoeSizeUnit: 'EU',
    })

    const customer = await t.run(async (ctx) => {
      const profile = await ctx.db.get(profileId)
      return profile?.customerId ? ctx.db.get(profile.customerId) : null
    })

    expect(customer).not.toBeNull()
    expect(customer!.heightCm).toBe(178)
    expect(customer!.weightKg).toBe(75)
    expect(customer!.shoeSize).toBe(42)
    expect(customer!.shoeSizeUnit).toBe('EU')
  })

  it('saves rental checklist to customer profile', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx) => seedPortalFixture(ctx))

    const checklist = {
      mask: 'rent' as const,
      bcd: 'rent' as const,
      wetsuit: 'own' as const,
      fins: 'rent' as const,
      regulator: 'rent' as const,
    }

    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      rentalChecklist: checklist,
    })

    const profile = await t.run(async (ctx) => ctx.db.get(profileId))

    expect(profile?.rentalChecklist).toBeDefined()
    expect(profile!.rentalChecklist!.mask).toBe('rent')
    expect(profile!.rentalChecklist!.bcd).toBe('rent')
    expect(profile!.rentalChecklist!.wetsuit).toBe('own')
    expect(profile!.rentalChecklist!.fins).toBe('rent')
    expect(profile!.rentalChecklist!.regulator).toBe('rent')
  })

  it('links equipment data to correct booking via token', async () => {
    const t = makeT()

    // Create two separate fixtures
    const { token: tokenA, profileId: profileAId } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      await seedCustomerForProfile(ctx, fixture.profileId)
      return fixture
    })

    const tokenB = testToken('tok-equip-b')
    await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        ownerId: 'dc-equip-test-b',
        ownerType: 'DiveCenter',
        status: 'Draft',
        createdAt: Date.now(),
        holdTTL: HOLD_TTL,
        paid: false,
        activityType: ['DSD'],
        startDate: testDate(7),
        endDate: testDate(7),
        divers: [],
        operatorName: 'Equip DC B',
        portalContact: false,
        portalMedical: false,
        portalWaiver: false,
        medicalHardBlock: false,
        bookingFormComplete: false,
        customerFormComplete: false,
        expiresAt: Date.now() + HOLD_TTL,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      await ctx.db.insert('bookingLinks', {
        bookingId,
        token: tokenB,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        customerName: 'Dani Diver',
        email: 'dani@example.com',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      await ctx.db.insert('customerProfiles', {
        bookingId,
        linkToken: tokenB,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    })

    // Only submit equipment for token A
    await t.mutation(api.portalDraft.saveEquipmentData, {
      token: tokenA,
      heightCm: 165,
      weightKg: 60,
    })

    // Profile A has customer with sizing; Profile B has no sizing
    const { profileA } = await t.run(async (ctx) => {
      const profileA = await ctx.db.get(profileAId)
      return { profileA }
    })

    const customerA = profileA?.customerId
      ? await t.run(async (ctx) => ctx.db.get(profileA.customerId!))
      : null

    expect(customerA?.heightCm).toBe(165)
    expect(customerA?.weightKg).toBe(60)
  })
})
