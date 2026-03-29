/**
 * DD-193: Portal sanitization gap — savePortalContact + saveMedicalAnswers
 *
 * Unit tests for sanitization of portal contact fields and medical answers.
 * Behavioral tests that submit adversarial strings through the mutation layer
 * and verify sanitized values are stored.
 */

import { describe, it, expect } from 'vitest'
import { api } from '../../convex/_generated/api'
import { dob, passportExpiry, testDate } from '../helpers/dates'
import { makeT } from '../helpers/convex-helpers'
import { seedPortalFixture, type SeedCtx } from '../fixtures'
import { decryptMedicalForTest } from '../helpers/crypto'
import {
  sanitizeString,
  sanitizeFields,
  sanitizePassport,
  sanitizeMedicalAnswers,
  PORTAL_CONTACT_FIELDS,
} from '../../convex/lib/sanitize'

const TEST_DOB = dob(35)
const TEST_PASSPORT_EXPIRY = passportExpiry()

/** Minimal valid contact payload for savePortalContact. */
function makeContactArgs(token: string, overrides: Record<string, unknown> = {}) {
  return {
    token,
    legalFirstName: 'Test',
    legalLastName: 'Diver',
    email: 'test@example.com',
    phone: '+61 412 345 678',
    dateOfBirth: TEST_DOB,
    gender: 'M' as const,
    nationality: 'Australia',
    passportNumber: 'PA1234567',
    passportIssuingCountry: 'Australia',
    passportExpirationDate: TEST_PASSPORT_EXPIRY,
    emergencyContactName: 'Jane Diver',
    emergencyContactPhone: '+61 400 111 222',
    emergencyContactRelation: 'Spouse',
    ...overrides,
  }
}

// ── Unit: PORTAL_CONTACT_FIELDS config ────────────────────────────────────────

describe('PORTAL_CONTACT_FIELDS config', () => {
  it('covers all 13+ string fields from savePortalContact', () => {
    const requiredFields = [
      'legalFirstName',
      'legalLastName',
      'preferredName',
      'email',
      'phone',
      'nationality',
      'passportNumber',
      'passportIssuingCountry',
      'emergencyContactName',
      'emergencyContactPhone',
      'emergencyContactRelation',
      'agency',
      'agencyID',
      'allergies',
    ]
    for (const field of requiredFields) {
      expect(PORTAL_CONTACT_FIELDS).toHaveProperty(field)
      expect(typeof PORTAL_CONTACT_FIELDS[field]).toBe('number')
    }
  })
})

// ── Unit: sanitizePassport ─────────────────────────────────────────────────────

describe('sanitizePassport', () => {
  it('strips zero-width characters from passport number', () => {
    expect(sanitizePassport('PA\u200B1234567')).toBe('PA1234567')
  })

  it('uppercases lowercase passport numbers', () => {
    expect(sanitizePassport('pa1234567')).toBe('PA1234567')
  })

  it('strips non-alphanumeric characters except hyphen', () => {
    expect(sanitizePassport('PA-123 456!@#7')).toBe('PA-1234567')
  })

  it('preserves hyphens in passport number', () => {
    expect(sanitizePassport('PA-1234567')).toBe('PA-1234567')
  })

  it('truncates to 20 characters max', () => {
    const long = 'A'.repeat(30)
    expect(sanitizePassport(long).length).toBe(20)
  })

  it('handles empty string', () => {
    expect(sanitizePassport('')).toBe('')
  })

  it('strips control characters then normalizes', () => {
    expect(sanitizePassport('\u0000pa\u202E123')).toBe('PA123')
  })
})

// ── Unit: sanitizeMedicalAnswers ──────────────────────────────────────────────

describe('sanitizeMedicalAnswers', () => {
  it('sanitizes string values in medical answers', () => {
    const answers: Record<string, boolean | string> = {
      medical_q1: false,
      medical_q2: true,
      details: '  some\u200B detail  ',
    }
    const result = sanitizeMedicalAnswers(answers)
    expect(result.details).toBe('some detail')
  })

  it('leaves boolean values untouched', () => {
    const answers: Record<string, boolean | string> = {
      medical_q1: false,
      medical_q2: true,
    }
    const result = sanitizeMedicalAnswers(answers)
    expect(result.medical_q1).toBe(false)
    expect(result.medical_q2).toBe(true)
  })

  it('truncates long string values', () => {
    const answers: Record<string, boolean | string> = {
      details: 'x'.repeat(3000),
    }
    const result = sanitizeMedicalAnswers(answers)
    expect((result.details as string).length).toBeLessThanOrEqual(2000)
  })

  it('strips control characters from string values', () => {
    const answers: Record<string, boolean | string> = {
      notes: 'hello\u0000world',
    }
    const result = sanitizeMedicalAnswers(answers)
    expect(result.notes).toBe('helloworld')
  })

  it('does not mutate original object', () => {
    const answers: Record<string, boolean | string> = {
      notes: '  padded  ',
      medical_q1: true,
    }
    const result = sanitizeMedicalAnswers(answers)
    expect(answers.notes).toBe('  padded  ')
    expect(result.notes).toBe('padded')
  })
})

// ── Unit: sanitizeFields with PORTAL_CONTACT_FIELDS ──────────────────────────

describe('sanitizeFields with PORTAL_CONTACT_FIELDS', () => {
  it('strips zero-width chars from name fields', () => {
    const input = { legalFirstName: 'Jo\u200Bhn', legalLastName: 'D\u200Boe' }
    const result = sanitizeFields(input, PORTAL_CONTACT_FIELDS)
    expect(result.legalFirstName).toBe('John')
    expect(result.legalLastName).toBe('Doe')
  })

  it('truncates name at max length', () => {
    const longName = 'A'.repeat(300)
    const input = { legalFirstName: longName }
    const result = sanitizeFields(input, PORTAL_CONTACT_FIELDS)
    expect(result.legalFirstName.length).toBe(200) // NAME_MAX
  })

  it('removes control chars from emergency contact fields', () => {
    const input = {
      emergencyContactName: 'Jane\u0000 Doe',
      emergencyContactPhone: '+61\u200B400111222',
      emergencyContactRelation: 'Spo\u202Euse',
    }
    const result = sanitizeFields(input, PORTAL_CONTACT_FIELDS)
    expect(result.emergencyContactName).toBe('Jane Doe')
    expect(result.emergencyContactPhone).toBe('+61400111222')
    expect(result.emergencyContactRelation).toBe('Spouse')
  })
})

// ── Behavioral: savePortalContact with adversarial strings ────────────────────

describe('savePortalContact — sanitization behavioral', () => {
  it('sanitizes zero-width characters and trims strings before DB write', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-sanitize-test',
          activityType: ['OW'],
          operatorName: 'Sanitize DC',
          bookingFormComplete: false,
          divers: [
            {
              name: 'Dirty Input Diver',
              abbrev: 'D',
              flag: { code: 'AU', label: 'Australia' },
              startDate: testDate(5),
              endDate: testDate(5),
              activityType: ['OW'],
            },
          ],
        },
        link: { customerName: 'Dirty Input Diver', email: 'dirty@example.com' } as Record<string, unknown>,
      }),
    )

    await t.mutation(
      api.customers.savePortalContact,
      makeContactArgs(token, {
        legalFirstName: '  Jo\u200Bhn  ',
        legalLastName: '  D\u0000oe  ',
        email: '  Test@EXAMPLE.com  ',
        passportNumber: 'pa\u200B-123 456!7',
        emergencyContactName: '  Jane\u202E Doe  ',
        nationality: '  Aus\u200Btralia  ',
      }),
    )

    const { customer } = await t.run(async (ctx: SeedCtx) => {
      const profile = await ctx.db.get(profileId)
      const customer = profile?.customerId ? await ctx.db.get(profile.customerId) : null
      return { customer }
    })

    expect(customer).not.toBeNull()
    // Zero-width stripped, trimmed
    expect(customer!.legalFirstName).toBe('John')
    expect(customer!.legalLastName).toBe('Doe')
    // Email lowercased and trimmed
    expect(customer!.email).toBe('test@example.com')
    // Passport: stripped to alphanumeric+hyphen, uppercased
    expect(customer!.passportNumber).toBe('PA-1234567')
    // Emergency contact: control chars stripped, trimmed
    expect(customer!.emergencyContactName).toBe('Jane Doe')
    // Nationality: zero-width stripped, trimmed
    expect(customer!.nationality).toBe('Australia')
  })

  it('truncates overly long fields to max length', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-sanitize-len',
          activityType: ['OW'],
          operatorName: 'Length DC',
          bookingFormComplete: false,
          divers: [
            {
              name: 'Long Name Diver',
              abbrev: 'L',
              flag: { code: 'AU', label: 'Australia' },
              startDate: testDate(5),
              endDate: testDate(5),
              activityType: ['OW'],
            },
          ],
        },
        link: { customerName: 'Long Name Diver', email: 'long@example.com' } as Record<string, unknown>,
      }),
    )

    await t.mutation(
      api.customers.savePortalContact,
      makeContactArgs(token, {
        legalFirstName: 'A'.repeat(300),
        allergies: 'B'.repeat(3000),
      }),
    )

    const { customer } = await t.run(async (ctx: SeedCtx) => {
      const profile = await ctx.db.get(profileId)
      const customer = profile?.customerId ? await ctx.db.get(profile.customerId) : null
      return { customer }
    })

    expect(customer).not.toBeNull()
    expect(customer!.legalFirstName.length).toBe(200) // NAME_MAX
    expect(customer!.allergies!.length).toBe(2000) // LONG_TEXT_MAX
  })
})

// ── Behavioral: saveMedicalAnswers with adversarial strings ──────────────────

describe('saveMedicalAnswers — sanitization behavioral', () => {
  const ALL_NO: Record<string, boolean> = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`medical_q${i + 1}`, false]),
  )

  it('sanitizes string values in answers, leaves booleans untouched', async () => {
    const t = makeT()
    const { token, profileId } = await t.run(async (ctx: SeedCtx) =>
      seedPortalFixture(ctx, {
        booking: {
          ownerId: 'dc-med-sanitize',
          activityType: ['OW'],
          operatorName: 'Med Sanitize DC',
          bookingFormComplete: false,
        },
      }),
    )

    await t.mutation(api.customerProfiles.saveMedicalAnswers, {
      token,
      answers: {
        ...ALL_NO,
        medical_details: '  dirty\u200B string\u0000  ',
      },
    })

    const profile = await t.run(async (ctx: SeedCtx) => ctx.db.get(profileId))
    // medicalAnswers is now encrypted — decrypt to verify sanitization
    const answers = await decryptMedicalForTest(profile!.medicalAnswers!)

    // Booleans untouched
    expect(answers.medical_q1).toBe(false)
    // String sanitized
    expect(answers.medical_details).toBe('dirty string')
  })
})
