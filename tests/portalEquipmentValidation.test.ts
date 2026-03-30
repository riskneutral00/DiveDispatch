import { describe, it, expect } from 'vitest'
import { api } from '../convex/_generated/api'
import { testDate, passportExpiry, dob } from './helpers/dates'
import { makeT, expectConvexError } from './helpers/convex-helpers'
import { seedPortalFixture, type SeedCtx } from './fixtures'
import { ErrorCode } from '../convex/lib/errorCodes'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Seed a portal fixture with contact step already complete (customer record linked). */
async function seedWithCustomer(t: ReturnType<typeof makeT>) {
  const { token, profileId, bookingId } = await t.run(async (ctx: SeedCtx) => {
    const fixture = await seedPortalFixture(ctx, {
      booking: {
        ownerId: 'dc-equip-val',
        activityType: ['DSD'],
        operatorName: 'Validation DC',
        bookingFormComplete: false,
        divers: [
          {
            name: 'Val Diver',
            abbrev: 'V',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(5),
            activityType: ['DSD'],
          },
        ],
      },
      link: { customerName: 'Val Diver', email: 'val@example.com' },
    })

    // Create customer and link to profile (contact step complete)
    const customerId = await ctx.db.insert('customers', {
      legalFirstName: 'Val',
      legalLastName: 'Diver',
      email: 'val@example.com',
      phone: '+66 81 234 5678',
      dateOfBirth: dob(28),
      gender: 'M',
      nationality: 'Thailand',
      passportNumber: 'TH1234567',
      passportIssuingCountry: 'Thailand',
      passportExpirationDate: passportExpiry(3),
      emergencyContactName: 'EC Name',
      emergencyContactPhone: '+66 81 999 0000',
      emergencyContactRelation: 'Friend',
      createdAt: Date.now(),
    })
    await ctx.db.patch(fixture.profileId, { customerId })

    return fixture
  })
  return { token, profileId, bookingId }
}

/** Seed a portal fixture without customer (no contact step). */
async function seedWithoutCustomer(t: ReturnType<typeof makeT>) {
  return t.run(async (ctx: SeedCtx) =>
    seedPortalFixture(ctx, {
      booking: {
        ownerId: 'dc-equip-val',
        activityType: ['DSD'],
        operatorName: 'Validation DC',
        bookingFormComplete: false,
        divers: [
          {
            name: 'Val Diver',
            abbrev: 'V',
            flag: { code: 'TH', label: 'Thailand' },
            startDate: testDate(5),
            endDate: testDate(5),
            activityType: ['DSD'],
          },
        ],
      },
      link: { customerName: 'Val Diver', email: 'val@example.com' },
    }),
  )
}

const ALL_OWN_CHECKLIST = {
  mask: 'own' as const,
  bcd: 'own' as const,
  wetsuit: 'own' as const,
  fins: 'own' as const,
  regulator: 'own' as const,
}

const ALL_RENT_CHECKLIST = {
  mask: 'rent' as const,
  bcd: 'rent' as const,
  wetsuit: 'rent' as const,
  fins: 'rent' as const,
  regulator: 'rent' as const,
}

// ─── Range validation ────────────────────────────────────────────────────────

describe('saveEquipmentData — range validation', () => {
  it('rejects heightCm below 50', async () => {
    const t = makeT()
    const { token } = await seedWithCustomer(t)

    await expectConvexError(
      t.mutation(api.portalDraft.saveEquipmentData, {
        token,
        heightCm: 10,
        rentalChecklist: ALL_OWN_CHECKLIST,
      }),
      ErrorCode.VALIDATION,
    )
  })

  it('rejects heightCm above 250', async () => {
    const t = makeT()
    const { token } = await seedWithCustomer(t)

    await expectConvexError(
      t.mutation(api.portalDraft.saveEquipmentData, {
        token,
        heightCm: 300,
        rentalChecklist: ALL_OWN_CHECKLIST,
      }),
      ErrorCode.VALIDATION,
    )
  })

  it('rejects weightKg below 15', async () => {
    const t = makeT()
    const { token } = await seedWithCustomer(t)

    await expectConvexError(
      t.mutation(api.portalDraft.saveEquipmentData, {
        token,
        weightKg: 5,
        rentalChecklist: ALL_OWN_CHECKLIST,
      }),
      ErrorCode.VALIDATION,
    )
  })

  it('rejects weightKg above 300', async () => {
    const t = makeT()
    const { token } = await seedWithCustomer(t)

    await expectConvexError(
      t.mutation(api.portalDraft.saveEquipmentData, {
        token,
        weightKg: 400,
        rentalChecklist: ALL_OWN_CHECKLIST,
      }),
      ErrorCode.VALIDATION,
    )
  })

  it('rejects shoeSize below 15', async () => {
    const t = makeT()
    const { token } = await seedWithCustomer(t)

    await expectConvexError(
      t.mutation(api.portalDraft.saveEquipmentData, {
        token,
        shoeSize: 5,
        rentalChecklist: ALL_OWN_CHECKLIST,
      }),
      ErrorCode.VALIDATION,
    )
  })

  it('rejects shoeSize above 55', async () => {
    const t = makeT()
    const { token } = await seedWithCustomer(t)

    await expectConvexError(
      t.mutation(api.portalDraft.saveEquipmentData, {
        token,
        shoeSize: 60,
        rentalChecklist: ALL_OWN_CHECKLIST,
      }),
      ErrorCode.VALIDATION,
    )
  })

  it('accepts valid boundary values (heightCm=50, weightKg=15, shoeSize=15)', async () => {
    const t = makeT()
    const { token, profileId } = await seedWithCustomer(t)

    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      heightCm: 50,
      weightKg: 15,
      shoeSize: 15,
      rentalChecklist: ALL_OWN_CHECKLIST,
    })

    const customer = await t.run(async (ctx: SeedCtx) => {
      const profile = await ctx.db.get(profileId)
      return profile?.customerId ? ctx.db.get(profile.customerId) : null
    })

    expect(customer!.heightCm).toBe(50)
    expect(customer!.weightKg).toBe(15)
    expect(customer!.shoeSize).toBe(15)
  })

  it('accepts valid upper boundary values (heightCm=250, weightKg=300, shoeSize=55)', async () => {
    const t = makeT()
    const { token, profileId } = await seedWithCustomer(t)

    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      heightCm: 250,
      weightKg: 300,
      shoeSize: 55,
      rentalChecklist: ALL_OWN_CHECKLIST,
    })

    const customer = await t.run(async (ctx: SeedCtx) => {
      const profile = await ctx.db.get(profileId)
      return profile?.customerId ? ctx.db.get(profile.customerId) : null
    })

    expect(customer!.heightCm).toBe(250)
    expect(customer!.weightKg).toBe(300)
    expect(customer!.shoeSize).toBe(55)
  })
})

// ─── Conditional validation (renting requires measurements) ──────────────────

describe('saveEquipmentData — conditional validation when renting', () => {
  it('rejects rental with missing heightCm and weightKg', async () => {
    const t = makeT()
    const { token } = await seedWithCustomer(t)

    await expectConvexError(
      t.mutation(api.portalDraft.saveEquipmentData, {
        token,
        rentalChecklist: ALL_RENT_CHECKLIST,
      }),
      ErrorCode.VALIDATION,
    )
  })

  it('rejects rental with heightCm but missing weightKg', async () => {
    const t = makeT()
    const { token } = await seedWithCustomer(t)

    await expectConvexError(
      t.mutation(api.portalDraft.saveEquipmentData, {
        token,
        heightCm: 170,
        rentalChecklist: ALL_RENT_CHECKLIST,
      }),
      ErrorCode.VALIDATION,
    )
  })

  it('rejects rental with weightKg but missing heightCm', async () => {
    const t = makeT()
    const { token } = await seedWithCustomer(t)

    await expectConvexError(
      t.mutation(api.portalDraft.saveEquipmentData, {
        token,
        weightKg: 70,
        rentalChecklist: ALL_RENT_CHECKLIST,
      }),
      ErrorCode.VALIDATION,
    )
  })

  it('rejects fins=rent without shoeSize', async () => {
    const t = makeT()
    const { token } = await seedWithCustomer(t)

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
      ErrorCode.VALIDATION,
    )
  })

  it('rejects mask=rent + needsPoweredLenses=true without prescriptionStrength', async () => {
    const t = makeT()
    const { token } = await seedWithCustomer(t)

    await expectConvexError(
      t.mutation(api.portalDraft.saveEquipmentData, {
        token,
        heightCm: 170,
        weightKg: 70,
        needsPoweredLenses: true,
        rentalChecklist: {
          mask: 'rent',
          bcd: 'own',
          wetsuit: 'own',
          fins: 'own',
          regulator: 'own',
        },
      }),
      ErrorCode.VALIDATION,
    )
  })

  it('accepts mask=rent + needsPoweredLenses=true with prescriptionStrength', async () => {
    const t = makeT()
    const { token, profileId } = await seedWithCustomer(t)

    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      heightCm: 170,
      weightKg: 70,
      needsPoweredLenses: true,
      prescriptionStrength: 'L: -2.00, R: -2.50',
      rentalChecklist: {
        mask: 'rent',
        bcd: 'own',
        wetsuit: 'own',
        fins: 'own',
        regulator: 'own',
      },
    })

    const customer = await t.run(async (ctx: SeedCtx) => {
      const profile = await ctx.db.get(profileId)
      return profile?.customerId ? ctx.db.get(profile.customerId) : null
    })

    expect(customer!.prescriptionStrength).toBe('L: -2.00, R: -2.50')
  })

  it('accepts mask=rent + needsPoweredLenses=false without prescriptionStrength', async () => {
    const t = makeT()
    const { token } = await seedWithCustomer(t)

    // Should not throw — powered lenses not needed, so prescription not required
    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      heightCm: 170,
      weightKg: 70,
      rentalChecklist: {
        mask: 'rent',
        bcd: 'own',
        wetsuit: 'own',
        fins: 'own',
        regulator: 'own',
      },
    })
  })

  it('does not require measurements when all items are own', async () => {
    const t = makeT()
    const { token, profileId } = await seedWithCustomer(t)

    // Should succeed — no rentals, no measurements required
    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      rentalChecklist: ALL_OWN_CHECKLIST,
    })

    const profile = await t.run(async (ctx: SeedCtx) => ctx.db.get(profileId))
    expect(profile!.rentalChecklist).toEqual(ALL_OWN_CHECKLIST)
  })

  it('accepts fins=rent with valid shoeSize', async () => {
    const t = makeT()
    const { token, profileId } = await seedWithCustomer(t)

    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      heightCm: 170,
      weightKg: 70,
      shoeSize: 42,
      rentalChecklist: {
        mask: 'own',
        bcd: 'own',
        wetsuit: 'own',
        fins: 'rent',
        regulator: 'own',
      },
    })

    const customer = await t.run(async (ctx: SeedCtx) => {
      const profile = await ctx.db.get(profileId)
      return profile?.customerId ? ctx.db.get(profile.customerId) : null
    })

    expect(customer!.shoeSize).toBe(42)
  })
})

// ─── Valid submissions still persist correctly ───────────────────────────────

describe('saveEquipmentData — valid submissions persist', () => {
  it('persists full valid rental submission with all measurements', async () => {
    const t = makeT()
    const { token, profileId } = await seedWithCustomer(t)

    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      heightCm: 175,
      weightKg: 80,
      shoeSize: 44,
      shoeSizeUnit: 'EU',
      needsPoweredLenses: true,
      prescriptionStrength: '-3.00',
      rentalChecklist: {
        ...ALL_RENT_CHECKLIST,
        maskPrescription: 'L: -3.00, R: -3.00',
      },
    })

    const { customer, profile } = await t.run(async (ctx: SeedCtx) => {
      const profile = await ctx.db.get(profileId)
      const customer = profile?.customerId ? await ctx.db.get(profile.customerId) : null
      return { customer, profile }
    })

    expect(customer!.heightCm).toBe(175)
    expect(customer!.weightKg).toBe(80)
    expect(customer!.shoeSize).toBe(44)
    expect(customer!.needsPoweredLenses).toBe(true)
    expect(customer!.prescriptionStrength).toBe('-3.00')
    expect(profile!.rentalChecklist).toEqual({
      ...ALL_RENT_CHECKLIST,
      maskPrescription: 'L: -3.00, R: -3.00',
    })
  })

  it('persists rental checklist without customer (contact step not done)', async () => {
    const t = makeT()
    const { token, profileId } = await seedWithoutCustomer(t)

    // Should save checklist to profile even without customer record
    await t.mutation(api.portalDraft.saveEquipmentData, {
      token,
      rentalChecklist: ALL_OWN_CHECKLIST,
    })

    const profile = await t.run(async (ctx: SeedCtx) => ctx.db.get(profileId))
    expect(profile!.rentalChecklist).toEqual(ALL_OWN_CHECKLIST)
  })
})
