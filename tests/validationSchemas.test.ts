import { describe, it, expect } from 'vitest'
import {
  addressLocationSchema,
  makeCustomerContactSchema,
  medicalAnswersSchema,
  makeWaiverSchema,
  equipmentSizingSchema,
  bookingDetailsSchema,
  diverEntrySchema,
} from '../src/lib/validation/schemas'

describe('addressLocationSchema', () => {
  it('accepts valid structured address', () => {
    const result = addressLocationSchema.safeParse({
      address: { city: 'Koh Tao', country: 'TH' },
      lat: 10.1,
      lng: 99.8,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing city', () => {
    const result = addressLocationSchema.safeParse({
      address: { city: '', country: 'TH' },
      lat: 0,
      lng: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing country', () => {
    const result = addressLocationSchema.safeParse({
      address: { city: 'Koh Tao', country: '' },
      lat: 0,
      lng: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('makeCustomerContactSchema', () => {
  const validContact = {
    legalFirstName: 'Alice',
    legalLastName: 'Smith',
    email: 'alice@example.com',
    phone: '+66812345678',
    dateOfBirth: '1990-01-01',
    gender: 'F' as const,
    nationality: 'US',
    passportNumber: 'A12345',
    passportIssuingCountry: 'US',
    passportExpirationDate: '2030-01-01',
    emergencyContactName: 'Bob',
    emergencyContactPhone: '+1234567890',
    emergencyContactRelation: 'Spouse',
    languages: [{ code: 'en-GB', label: 'English' }],
  }

  it('base schema accepts valid contact without cert fields', () => {
    const schema = makeCustomerContactSchema()
    const result = schema.safeParse(validContact)
    expect(result.success).toBe(true)
  })

  it('schema without cert activity does not require agency', () => {
    const schema = makeCustomerContactSchema(['OW'])
    const result = schema.safeParse(validContact)
    expect(result.success).toBe(true)
  })

  it('schema with cert activity requires agency and agencyID', () => {
    const schema = makeCustomerContactSchema(['AOW'])
    const result = schema.safeParse(validContact)
    expect(result.success).toBe(false)
  })

  it('schema with cert activity passes when agency + agencyID provided', () => {
    const schema = makeCustomerContactSchema(['AOW'])
    const result = schema.safeParse({
      ...validContact,
      agency: 'PADI',
      agencyID: '12345',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const schema = makeCustomerContactSchema()
    const result = schema.safeParse({
      ...validContact,
      email: 'not-email',
    })
    expect(result.success).toBe(false)
  })
})

describe('medicalAnswersSchema', () => {
  const allFalse = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`medical_q${i + 1}`, false]),
  )

  it('accepts all false answers', () => {
    expect(medicalAnswersSchema.safeParse(allFalse).success).toBe(true)
  })

  it('accepts mixed answers', () => {
    expect(
      medicalAnswersSchema.safeParse({ ...allFalse, medical_q3: true }).success,
    ).toBe(true)
  })

  it('rejects non-boolean value', () => {
    expect(
      medicalAnswersSchema.safeParse({ ...allFalse, medical_q1: 'yes' }).success,
    ).toBe(false)
  })

  it('rejects missing question', () => {
    const { medical_q10, ...missing } = allFalse
    expect(medicalAnswersSchema.safeParse(missing).success).toBe(false)
  })
})

describe('makeWaiverSchema', () => {
  const validWaiver = {
    waiverSignedAt: Date.now(),
    signatureFileId: 'sig-123',
  }

  it('base schema accepts waiver without guardian sig', () => {
    const schema = makeWaiverSchema()
    expect(schema.safeParse(validWaiver).success).toBe(true)
  })

  it('requires guardian sig for minor (under 18)', () => {
    const schema = makeWaiverSchema('2015-01-01', '2026-03-28')
    const result = schema.safeParse(validWaiver)
    expect(result.success).toBe(false)
  })

  it('accepts waiver with guardian sig for minor', () => {
    const schema = makeWaiverSchema('2015-01-01', '2026-03-28')
    const result = schema.safeParse({
      ...validWaiver,
      guardianSignatureFileId: 'guardian-sig-456',
    })
    expect(result.success).toBe(true)
  })

  it('does not require guardian sig for adult', () => {
    const schema = makeWaiverSchema('1990-01-01', '2026-03-28')
    expect(schema.safeParse(validWaiver).success).toBe(true)
  })
})

describe('equipmentSizingSchema', () => {
  it('accepts valid measurements', () => {
    const result = equipmentSizingSchema.safeParse({
      heightCm: 175,
      weightKg: 70,
      shoeSize: 42,
      shoeSizeUnit: 'EU',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all optional)', () => {
    expect(equipmentSizingSchema.safeParse({}).success).toBe(true)
  })

  it('rejects height below 50', () => {
    expect(equipmentSizingSchema.safeParse({ heightCm: 10 }).success).toBe(false)
  })

  it('rejects height above 300', () => {
    expect(equipmentSizingSchema.safeParse({ heightCm: 350 }).success).toBe(false)
  })
})

describe('bookingDetailsSchema', () => {
  it('accepts valid booking details', () => {
    const result = bookingDetailsSchema.safeParse({
      activityType: ['OW'],
      startDate: '2026-04-01',
      endDate: '2026-04-03',
      portalContact: true,
      portalMedical: true,
      portalWaiver: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty activity type', () => {
    const result = bookingDetailsSchema.safeParse({
      activityType: [],
      startDate: '2026-04-01',
      endDate: '2026-04-03',
      portalContact: true,
      portalMedical: true,
      portalWaiver: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects endDate before startDate', () => {
    const result = bookingDetailsSchema.safeParse({
      activityType: ['OW'],
      startDate: '2026-04-05',
      endDate: '2026-04-01',
      portalContact: true,
      portalMedical: true,
      portalWaiver: true,
    })
    expect(result.success).toBe(false)
  })
})

describe('diverEntrySchema', () => {
  const validDiver = {
    name: 'Jane Doe',
    flag: { code: 'US', label: 'United States' },
    startDate: '2026-04-01',
    endDate: '2026-04-03',
    activityType: ['OW'] as const,
  }

  it('accepts valid diver entry', () => {
    expect(diverEntrySchema.safeParse(validDiver).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(diverEntrySchema.safeParse({ ...validDiver, name: '' }).success).toBe(false)
  })

  it('rejects empty activity type array', () => {
    expect(diverEntrySchema.safeParse({ ...validDiver, activityType: [] }).success).toBe(false)
  })

  it('rejects endDate before startDate', () => {
    expect(diverEntrySchema.safeParse({
      ...validDiver,
      startDate: '2026-04-05',
      endDate: '2026-04-01',
    }).success).toBe(false)
  })

  it('accepts optional abbrev and agency', () => {
    expect(diverEntrySchema.safeParse({
      ...validDiver,
      abbrev: 'JD',
      agency: 'PADI',
    }).success).toBe(true)
  })

  it('accepts same start and end date', () => {
    expect(diverEntrySchema.safeParse({
      ...validDiver,
      startDate: '2026-04-01',
      endDate: '2026-04-01',
    }).success).toBe(true)
  })
})

describe('equipmentSizingSchema edge cases', () => {
  it('accepts rental checklist', () => {
    const result = equipmentSizingSchema.safeParse({
      rentalChecklist: {
        mask: 'own',
        bcd: 'rent',
        wetsuit: 'own',
        fins: 'rent',
        regulator: 'own',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid rental option', () => {
    const result = equipmentSizingSchema.safeParse({
      rentalChecklist: {
        mask: 'borrow',
        bcd: 'rent',
        wetsuit: 'own',
        fins: 'rent',
        regulator: 'own',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects weight below 20', () => {
    expect(equipmentSizingSchema.safeParse({ weightKg: 5 }).success).toBe(false)
  })

  it('accepts needsPoweredLenses flag', () => {
    expect(equipmentSizingSchema.safeParse({ needsPoweredLenses: true }).success).toBe(true)
  })
})
