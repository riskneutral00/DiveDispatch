import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { testDate, testToken, passportExpiry, dob } from '../helpers/dates'
import { seedPortalFixture, seedBooking, seedBookingLink, seedCustomerProfile, type SeedCtx } from '../fixtures'
import { makeT } from '../helpers/convex-helpers'

// ─── Setup ────────────────────────────────────────────────────────────────────

/** Seed a customer record and link it to the profile (contact step complete). */
async function seedCustomerForProfile(ctx: SeedCtx, profileId: Awaited<ReturnType<typeof seedPortalFixture>>['profileId']) {
  const customerId = await ctx.db.insert('customers', {
    legalFirstName: 'Carlos',
    legalLastName: 'Diver',
    email: 'carlos@example.com',
    phone: '+52 555 123 4567',
    dateOfBirth: dob(33),
    gender: 'M',
    nationality: 'Mexico',
    passportNumber: 'MX9876543',
    passportIssuingCountry: 'Mexico',
    passportExpirationDate: passportExpiry(3),
    emergencyContactName: 'Maria Diver',
    emergencyContactPhone: '+52 555 765 4321',
    emergencyContactRelation: 'Sibling',
    createdAt: Date.now(),
  })
  await ctx.db.patch(profileId, { customerId })
  return customerId
}

// ─── saveEquipmentData ────────────────────────────────────────────────────────

describe('saveEquipmentData', () => {
  it('saves sizing data to customer record', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx: SeedCtx) => {
      const fixture = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-equip-test',
          activityType: ['DSD'],
          operatorName: 'Equip DC',
          bookingFormComplete: false,
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
        },
        link: { token: 'tok-equip-1', customerName: 'Carlos Diver', email: 'carlos@example.com' },
        profile: { linkToken: 'tok-equip-1' },
      })
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

    const customer = await t.run(async (ctx: SeedCtx) => {
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
    const { token, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-equip-test',
          activityType: ['DSD'],
          operatorName: 'Equip DC',
          bookingFormComplete: false,
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
        },
        link: { token: 'tok-equip-2', customerName: 'Carlos Diver', email: 'carlos@example.com' },
        profile: { linkToken: 'tok-equip-2' },
      }),
    )

    const checklist = {
      mask: 'rent' as const,
      bcd: 'rent' as const,
      wetsuit: 'own' as const,
      fins: 'rent' as const,
      regulator: 'rent' as const,
    }

    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      heightCm: 175,
      weightKg: 70,
      shoeSize: 42,
      rentalChecklist: checklist,
    })

    const profile = await t.run(async (ctx: SeedCtx) => ctx.db.get(profileId))

    expect(profile!.rentalChecklist).toEqual({
      mask: 'rent',
      bcd: 'rent',
      wetsuit: 'own',
      fins: 'rent',
      regulator: 'rent',
    })
  })

  it('links equipment data to correct booking via token', async () => {
    const t = makeT()

    // Create two separate fixtures
    const { token: tokenA, profileId: profileAId } = await t.run(async (ctx: SeedCtx) => {
      const fixture = await seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-equip-test',
          activityType: ['DSD'],
          operatorName: 'Equip DC',
          bookingFormComplete: false,
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
        },
        link: { token: 'tok-equip-a', customerName: 'Carlos Diver', email: 'carlos@example.com' },
        profile: { linkToken: 'tok-equip-a' },
      })
      await seedCustomerForProfile(ctx, fixture.profileId)
      return fixture
    })

    const tokenB = testToken('tok-equip-b')
    await t.run(async (ctx: SeedCtx) => {
      const bookingId = await seedBooking(ctx, {
        ownerId: 'dc-equip-test-b',
        activityType: ['DSD'],
        startDate: testDate(7),
        endDate: testDate(7),
        divers: [],
        operatorName: 'Equip DC B',
        bookingFormComplete: false,
        expiresAt: Date.now() + 43_200_000,
      })
      await seedBookingLink(ctx, bookingId, {
        token: tokenB,
        customerName: 'Dani Diver',
        email: 'dani@example.com',
      })
      await seedCustomerProfile(ctx, bookingId, {
        linkToken: tokenB,
      })
    })

    // Only submit equipment for token A
    await t.mutation(api.portalDraft.saveEquipmentData, {
      token: tokenA,
      heightCm: 165,
      weightKg: 60,
    })

    // Profile A has customer with sizing; Profile B has no sizing
    const { profileA } = await t.run(async (ctx: SeedCtx) => {
      const profileA = await ctx.db.get(profileAId)
      return { profileA }
    })

    const customerA = profileA?.customerId
      ? await t.run(async (ctx: SeedCtx) => ctx.db.get(profileA.customerId!))
      : null

    expect(customerA?.heightCm).toBe(165)
    expect(customerA?.weightKg).toBe(60)
  })
})
