import { convexTest } from 'convex-test'
import { describe, it, expect } from 'vitest'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { testDate, testToken } from './helpers/dates'

// ─── Setup ────────────────────────────────────────────────────────────────────

const HOLD_TTL = 43_200_000
const modules = import.meta.glob('../convex/**/*.ts')

function makeT() {
  return convexTest(schema, modules)
}

type Ctx = Parameters<Parameters<ReturnType<typeof convexTest>['run']>[0]>[0]

/**
 * Seeds a portal fixture: booking, bookingLink, customerProfile.
 * Accepts overrides for each entity to exercise different scenarios.
 */
async function seedPortalFixture(
  ctx: Ctx,
  overrides: {
    bookingOverrides?: Record<string, unknown>
    linkOverrides?: Record<string, unknown>
    profileOverrides?: Record<string, unknown>
  } = {},
) {
  const bookingId = await ctx.db.insert('bookings', {
    ownerId: 'dc-portal-progress',
    ownerType: 'DiveCenter',
    status: 'Draft',
    createdAt: Date.now(),
    holdTTL: HOLD_TTL,
    paid: false,
    activityType: ['OW'],
    startDate: testDate(7),
    endDate: testDate(7),
    divers: [
      {
        name: 'Alice',
        abbrev: 'A',
        flag: { code: 'US', label: 'United States' },
        startDate: testDate(7),
        endDate: testDate(7),
        activityType: ['OW'],
      },
    ],
    operatorName: 'Test DC',
    portalContact: true,
    portalMedical: true,
    portalWaiver: true,
    medicalHardBlock: false,
    bookingFormComplete: false,
    customerFormComplete: false,
    expiresAt: Date.now() + HOLD_TTL,
    ...(overrides.bookingOverrides ?? {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const token = testToken('tok-progress')
  const linkId = await ctx.db.insert('bookingLinks', {
    bookingId,
    token,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    customerName: 'Alice',
    email: 'alice@example.com',
    ...(overrides.linkOverrides ?? {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const profileId = await ctx.db.insert('customerProfiles', {
    bookingId,
    linkToken: token,
    ...(overrides.profileOverrides ?? {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  return { bookingId, token, linkId, profileId }
}

/** Seeds a customer record and links it to the profile (contact step complete). */
async function seedCustomer(
  ctx: Ctx,
  profileId: Awaited<ReturnType<typeof seedPortalFixture>>['profileId'],
  customerOverrides: Record<string, unknown> = {},
) {
  const customerId = await ctx.db.insert('customers', {
    legalFirstName: 'Alice',
    legalLastName: 'Tester',
    email: 'alice@example.com',
    phone: '+1-555-0100',
    dateOfBirth: '1990-06-15',
    gender: 'F',
    nationality: 'US',
    passportNumber: 'US12345678',
    passportIssuingCountry: 'US',
    passportExpirationDate: testDate(365 * 4),
    emergencyContactName: 'Bob Tester',
    emergencyContactPhone: '+1-555-0101',
    emergencyContactRelation: 'Spouse',
    createdAt: Date.now(),
    ...customerOverrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  await ctx.db.patch(profileId, { customerId })
  return customerId
}

const FULL_RENTAL_CHECKLIST = {
  mask: 'rent' as const,
  bcd: 'rent' as const,
  wetsuit: 'own' as const,
  fins: 'rent' as const,
  regulator: 'own' as const,
}

const ALL_FALSE_MEDICAL = {
  medical_q1: false,
  medical_q2: false,
  medical_q3: false,
  medical_q4: false,
  medical_q5: false,
  medical_q6: false,
  medical_q7: false,
  medical_q8: false,
  medical_q9: false,
  medical_q10: false,
}

// ─── Invalid / expired token ─────────────────────────────────────────────────

describe('getPortalProgress — invalid/expired token', () => {
  it('returns null for non-existent token', async () => {
    const t = makeT()
    const result = await t.query(api.portalDraft.getPortalProgress, {
      token: 'does-not-exist',
    })
    expect(result).toBeNull()
  })

  it('returns null for expired link', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        linkOverrides: { expiresAt: Date.now() - 1000 },
      }),
    )
    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result).toBeNull()
  })

  it('returns null for used (submitted) link', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        linkOverrides: { usedAt: Date.now() - 5000 },
      }),
    )
    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result).toBeNull()
  })

  it('returns null for non-Draft booking (Upcoming)', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: { status: 'Upcoming' },
      }),
    )
    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result).toBeNull()
  })

  it('returns null for Cancelled booking', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: { status: 'Cancelled' },
      }),
    )
    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result).toBeNull()
  })
})

// ─── Fresh portal (no data filled) ──────────────────────────────────────────

describe('getPortalProgress — fresh portal (no data)', () => {
  it('all steps incomplete, firstIncompleteStep is contact', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => seedPortalFixture(ctx))

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result).not.toBeNull()
    expect(result!.contactComplete).toBe(false)
    expect(result!.medicalComplete).toBe(false)
    expect(result!.waiverComplete).toBe(false)
    expect(result!.equipmentComplete).toBe(false)
    expect(result!.firstIncompleteStep).toBe('contact')
  })

  it('all data fields are null when nothing is filled', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => seedPortalFixture(ctx))

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.contactData).toBeNull()
    expect(result!.medicalData).toBeNull()
    expect(result!.waiverSignedAt).toBeNull()
    expect(result!.equipmentData).toBeNull()
  })

  it('reports booking portal requirement flags correctly', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => seedPortalFixture(ctx))

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.requiresContact).toBe(true)
    expect(result!.requiresMedical).toBe(true)
    expect(result!.requiresWaiver).toBe(true)
  })

  it('reflects disabled portal steps when booking has them off', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: {
          portalContact: false,
          portalMedical: false,
          portalWaiver: false,
        },
      }),
    )

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.requiresContact).toBe(false)
    expect(result!.requiresMedical).toBe(false)
    expect(result!.requiresWaiver).toBe(false)
    // With no required steps, firstIncompleteStep should be submit
    expect(result!.firstIncompleteStep).toBe('submit')
  })
})

// ─── Pre-fill from existing customer profile ────────────────────────────────

describe('getPortalProgress — contact pre-fill from customer', () => {
  it('pre-fills contactData from linked customer record', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      await seedCustomer(ctx, fixture.profileId)
      return fixture
    })

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.contactComplete).toBe(true)
    expect(result!.contactData).not.toBeNull()
    expect(result!.contactData!.legalFirstName).toBe('Alice')
    expect(result!.contactData!.legalLastName).toBe('Tester')
    expect(result!.contactData!.email).toBe('alice@example.com')
    expect(result!.contactData!.phone).toBe('+1-555-0100')
    expect(result!.contactData!.gender).toBe('F')
    expect(result!.contactData!.nationality).toBe('US')
    expect(result!.contactData!.passportNumber).toBe('US12345678')
    expect(result!.contactData!.emergencyContactName).toBe('Bob Tester')
    expect(result!.contactData!.emergencyContactRelation).toBe('Spouse')
  })

  it('pre-fills optional customer fields (agency, agencyID, allergies)', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      await seedCustomer(ctx, fixture.profileId, {
        agency: 'PADI',
        agencyID: 'PADI-1234',
        allergies: 'Penicillin',
      })
      return fixture
    })

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.contactData!.agency).toBe('PADI')
    expect(result!.contactData!.agencyID).toBe('PADI-1234')
    expect(result!.contactData!.allergies).toBe('Penicillin')
  })

  it('optional fields are undefined when not set on customer', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      // Customer with no optional fields set
      await seedCustomer(ctx, fixture.profileId)
      return fixture
    })

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.contactData!.agency).toBeUndefined()
    expect(result!.contactData!.agencyID).toBeUndefined()
    expect(result!.contactData!.allergies).toBeUndefined()
    expect(result!.contactData!.preferredName).toBeUndefined()
  })
})

// ─── Equipment pre-fill from customer body measurements + rental checklist ──

describe('getPortalProgress — equipment pre-fill', () => {
  it('pre-fills body measurements from customer record', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      await seedCustomer(ctx, fixture.profileId, {
        heightCm: 175,
        weightKg: 72,
        shoeSize: 43,
        shoeSizeUnit: 'EU',
        needsPoweredLenses: true,
        prescriptionStrength: '-2.5',
      })
      return fixture
    })

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.equipmentData).not.toBeNull()
    expect(result!.equipmentData!.heightCm).toBe(175)
    expect(result!.equipmentData!.weightKg).toBe(72)
    expect(result!.equipmentData!.shoeSize).toBe(43)
    expect(result!.equipmentData!.shoeSizeUnit).toBe('EU')
    expect(result!.equipmentData!.needsPoweredLenses).toBe(true)
    expect(result!.equipmentData!.prescriptionStrength).toBe('-2.5')
  })

  it('pre-fills rental checklist from profile', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        profileOverrides: {
          rentalChecklist: FULL_RENTAL_CHECKLIST,
        },
      }),
    )

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.equipmentData).not.toBeNull()
    expect(result!.equipmentData!.rentalChecklist).toEqual(FULL_RENTAL_CHECKLIST)
  })

  it('combines customer body measurements and profile rental checklist', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx, {
        profileOverrides: {
          rentalChecklist: FULL_RENTAL_CHECKLIST,
        },
      })
      await seedCustomer(ctx, fixture.profileId, {
        heightCm: 168,
        weightKg: 65,
      })
      return fixture
    })

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.equipmentData!.heightCm).toBe(168)
    expect(result!.equipmentData!.weightKg).toBe(65)
    expect(result!.equipmentData!.rentalChecklist).toEqual(FULL_RENTAL_CHECKLIST)
  })

  it('equipmentData is null when no customer and no rental checklist', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => seedPortalFixture(ctx))

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.equipmentData).toBeNull()
  })

  it('customer with no body measurements and no checklist yields null equipmentData', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      // Customer exists but has no optional body measurement fields
      await seedCustomer(ctx, fixture.profileId)
      return fixture
    })

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    // Customer exists → contactComplete, but no body measurements or rental checklist
    // The function builds an empty EquipmentData {} then checks Object.keys.length > 0
    // With no body measurement fields and no rental checklist, it should be null
    expect(result!.equipmentData).toBeNull()
  })
})

// ─── Equipment completion flag logic ────────────────────────────────────────

describe('getPortalProgress — equipmentComplete flag', () => {
  it('equipmentComplete is true when all 5 rental checklist items are set', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        profileOverrides: {
          rentalChecklist: FULL_RENTAL_CHECKLIST,
        },
      }),
    )

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.equipmentComplete).toBe(true)
  })

  it('equipmentComplete is false when no rental checklist exists', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => seedPortalFixture(ctx))

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.equipmentComplete).toBe(false)
  })
})

// ─── Medical pre-fill and completion ────────────────────────────────────────

describe('getPortalProgress — medical data', () => {
  it('pre-fills medicalData from profile with answers and clearance flag', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        profileOverrides: {
          medicalAnswers: ALL_FALSE_MEDICAL,
          physicianClearanceRequired: false,
        },
      }),
    )

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.medicalComplete).toBe(true)
    expect(result!.medicalData).not.toBeNull()
    expect(result!.medicalData!.answers).toEqual(ALL_FALSE_MEDICAL)
    expect(result!.medicalData!.physicianClearanceRequired).toBe(false)
  })

  it('medicalComplete is false when medicalAnswers is empty object', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        profileOverrides: {
          medicalAnswers: {},
        },
      }),
    )

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.medicalComplete).toBe(false)
    expect(result!.medicalData).toBeNull()
  })

  it('medicalComplete is false when medicalAnswers not set', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => seedPortalFixture(ctx))

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.medicalComplete).toBe(false)
    expect(result!.medicalData).toBeNull()
  })

  it('preserves physicianClearanceRequired = true in pre-fill', async () => {
    const t = makeT()
    const medicalWithBlock = { ...ALL_FALSE_MEDICAL, medical_q1: true }
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        profileOverrides: {
          medicalAnswers: medicalWithBlock,
          physicianClearanceRequired: true,
        },
      }),
    )

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.medicalData!.physicianClearanceRequired).toBe(true)
    expect(result!.medicalData!.answers.medical_q1).toBe(true)
  })
})

// ─── Waiver pre-fill and completion ─────────────────────────────────────────

describe('getPortalProgress — waiver data', () => {
  it('waiverComplete is true and waiverSignedAt populated when signed', async () => {
    const t = makeT()
    const signedAt = Date.now() - 60_000
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        profileOverrides: {
          waiverSignedAt: signedAt,
        },
      }),
    )

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.waiverComplete).toBe(true)
    expect(result!.waiverSignedAt).toBe(signedAt)
  })

  it('waiverComplete is false and waiverSignedAt is null when unsigned', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => seedPortalFixture(ctx))

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.waiverComplete).toBe(false)
    expect(result!.waiverSignedAt).toBeNull()
  })
})

// ─── Partial completion scenarios ───────────────────────────────────────────

describe('getPortalProgress — partial completion / firstIncompleteStep', () => {
  it('contact done, medical not → firstIncompleteStep is medical', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx)
      await seedCustomer(ctx, fixture.profileId)
      return fixture
    })

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.contactComplete).toBe(true)
    expect(result!.medicalComplete).toBe(false)
    expect(result!.firstIncompleteStep).toBe('medical')
  })

  it('contact + medical done, waiver not → firstIncompleteStep is waiver', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx, {
        profileOverrides: {
          medicalAnswers: ALL_FALSE_MEDICAL,
          physicianClearanceRequired: false,
        },
      })
      await seedCustomer(ctx, fixture.profileId)
      return fixture
    })

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.contactComplete).toBe(true)
    expect(result!.medicalComplete).toBe(true)
    expect(result!.waiverComplete).toBe(false)
    expect(result!.firstIncompleteStep).toBe('waiver')
  })

  it('all required steps complete → firstIncompleteStep is submit', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx, {
        profileOverrides: {
          medicalAnswers: ALL_FALSE_MEDICAL,
          physicianClearanceRequired: false,
          waiverSignedAt: Date.now() - 30_000,
          rentalChecklist: FULL_RENTAL_CHECKLIST,
        },
      })
      await seedCustomer(ctx, fixture.profileId)
      return fixture
    })

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.contactComplete).toBe(true)
    expect(result!.medicalComplete).toBe(true)
    expect(result!.waiverComplete).toBe(true)
    expect(result!.equipmentComplete).toBe(true)
    expect(result!.firstIncompleteStep).toBe('submit')
  })

  it('only medical required and not done → firstIncompleteStep is medical', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: {
          portalContact: false,
          portalMedical: true,
          portalWaiver: false,
        },
      }),
    )

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.firstIncompleteStep).toBe('medical')
  })

  it('only waiver required and not done → firstIncompleteStep is waiver', async () => {
    const t = makeT()
    const { token } = await t.run(async (ctx) =>
      seedPortalFixture(ctx, {
        bookingOverrides: {
          portalContact: false,
          portalMedical: false,
          portalWaiver: true,
        },
      }),
    )

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.firstIncompleteStep).toBe('waiver')
  })

  it('skips non-required incomplete steps when finding firstIncompleteStep', async () => {
    const t = makeT()
    // Contact required + complete, medical NOT required (incomplete is ignored), waiver required + incomplete
    const { token } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx, {
        bookingOverrides: {
          portalContact: true,
          portalMedical: false,
          portalWaiver: true,
        },
      })
      await seedCustomer(ctx, fixture.profileId)
      return fixture
    })

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result!.contactComplete).toBe(true)
    expect(result!.medicalComplete).toBe(false)
    // Medical is not required, so it's skipped; waiver is next required incomplete
    expect(result!.firstIncompleteStep).toBe('waiver')
  })
})

// ─── Full completion ────────────────────────────────────────────────────────

describe('getPortalProgress — full completion', () => {
  it('returns all data populated and all steps complete', async () => {
    const t = makeT()
    const waiverTs = Date.now() - 120_000
    const { token } = await t.run(async (ctx) => {
      const fixture = await seedPortalFixture(ctx, {
        profileOverrides: {
          medicalAnswers: ALL_FALSE_MEDICAL,
          physicianClearanceRequired: false,
          waiverSignedAt: waiverTs,
          rentalChecklist: FULL_RENTAL_CHECKLIST,
        },
      })
      await seedCustomer(ctx, fixture.profileId, {
        heightCm: 180,
        weightKg: 80,
        shoeSize: 44,
        shoeSizeUnit: 'EU',
        agency: 'SSI',
        agencyID: 'SSI-5678',
      })
      return fixture
    })

    const result = await t.query(api.portalDraft.getPortalProgress, { token })
    expect(result).not.toBeNull()

    // Requirement flags
    expect(result!.requiresContact).toBe(true)
    expect(result!.requiresMedical).toBe(true)
    expect(result!.requiresWaiver).toBe(true)

    // All steps complete
    expect(result!.contactComplete).toBe(true)
    expect(result!.medicalComplete).toBe(true)
    expect(result!.waiverComplete).toBe(true)
    expect(result!.equipmentComplete).toBe(true)
    expect(result!.firstIncompleteStep).toBe('submit')

    // Contact data
    expect(result!.contactData!.legalFirstName).toBe('Alice')
    expect(result!.contactData!.agency).toBe('SSI')

    // Medical data
    expect(result!.medicalData!.answers).toEqual(ALL_FALSE_MEDICAL)
    expect(result!.medicalData!.physicianClearanceRequired).toBe(false)

    // Waiver
    expect(result!.waiverSignedAt).toBe(waiverTs)

    // Equipment (body + rental merged)
    expect(result!.equipmentData!.heightCm).toBe(180)
    expect(result!.equipmentData!.weightKg).toBe(80)
    expect(result!.equipmentData!.shoeSize).toBe(44)
    expect(result!.equipmentData!.rentalChecklist).toEqual(FULL_RENTAL_CHECKLIST)
  })
})
