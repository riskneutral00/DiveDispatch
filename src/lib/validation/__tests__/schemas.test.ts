import { describe, it, expect } from 'vitest'
import { makeWaiverSchema, makeCustomerContactSchema } from '../schemas'

// ── Helpers ──────────────────────────────────────────────────────────

/** Formats a Date as YYYY-MM-DD string. */
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Returns a YYYY-MM-DD string for someone who will be `age` years old at `ref`. */
function dobForAge(age: number, ref: Date = new Date()): string {
  const d = new Date(ref)
  d.setFullYear(d.getFullYear() - age)
  return fmt(d)
}

/** Builds a valid waiver data object. */
function validWaiver(overrides: Partial<{ guardianSignatureFileId: string }> = {}) {
  return {
    waiverSignedAt: Date.now(),
    signatureFileId: 'sig-file-123',
    ...overrides,
  }
}

// ── makeWaiverSchema — guardian signature for minors ──────────────────

describe('makeWaiverSchema', () => {
  it('passes for adult (18+) without guardian signature', () => {
    const bookingDate = new Date()
    const dob = dobForAge(25, bookingDate)
    const schema = makeWaiverSchema(dob, fmt(bookingDate))
    const result = schema.safeParse(validWaiver())
    expect(result.success).toBe(true)
  })

  it('passes for diver exactly 18 on booking start date without guardian signature', () => {
    const bookingDate = new Date()
    const dob = dobForAge(18, bookingDate)
    const schema = makeWaiverSchema(dob, fmt(bookingDate))
    const result = schema.safeParse(validWaiver())
    expect(result.success).toBe(true)
  })

  it('fails for diver who is 17 (under 18) without guardian signature', () => {
    const bookingDate = new Date()
    const dob = dobForAge(17, bookingDate)
    const schema = makeWaiverSchema(dob, fmt(bookingDate))
    const result = schema.safeParse(validWaiver())
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('guardianSignatureFileId')
      expect(result.error.issues[0].message).toBe(
        'Guardian signature required for divers under 18',
      )
    }
  })

  it('passes for minor (17) with guardian signature provided', () => {
    const bookingDate = new Date()
    const dob = dobForAge(17, bookingDate)
    const schema = makeWaiverSchema(dob, fmt(bookingDate))
    const result = schema.safeParse(
      validWaiver({ guardianSignatureFileId: 'guardian-sig-456' }),
    )
    expect(result.success).toBe(true)
  })

  it('fails for 10-year-old (minimum DSD age) without guardian signature', () => {
    const bookingDate = new Date()
    const dob = dobForAge(10, bookingDate)
    const schema = makeWaiverSchema(dob, fmt(bookingDate))
    const result = schema.safeParse(validWaiver())
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('guardianSignatureFileId')
    }
  })

  it('passes for 10-year-old with guardian signature', () => {
    const bookingDate = new Date()
    const dob = dobForAge(10, bookingDate)
    const schema = makeWaiverSchema(dob, fmt(bookingDate))
    const result = schema.safeParse(
      validWaiver({ guardianSignatureFileId: 'guardian-sig-789' }),
    )
    expect(result.success).toBe(true)
  })

  it('birthday edge: turns 18 the day after booking → still a minor', () => {
    const bookingDate = new Date()
    // Born 18 years ago but birthday is 1 day after booking
    const dob = new Date(bookingDate)
    dob.setFullYear(dob.getFullYear() - 18)
    dob.setDate(dob.getDate() + 1)
    const schema = makeWaiverSchema(fmt(dob), fmt(bookingDate))
    const result = schema.safeParse(validWaiver())
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('guardianSignatureFileId')
    }
  })

  it('skips age check when dateOfBirth is undefined', () => {
    const schema = makeWaiverSchema(undefined, fmt(new Date()))
    const result = schema.safeParse(validWaiver())
    expect(result.success).toBe(true)
  })

  it('skips age check when bookingStartDate is undefined', () => {
    const schema = makeWaiverSchema(dobForAge(10), undefined)
    const result = schema.safeParse(validWaiver())
    expect(result.success).toBe(true)
  })

  it('skips age check when both dates are undefined', () => {
    const schema = makeWaiverSchema(undefined, undefined)
    const result = schema.safeParse(validWaiver())
    expect(result.success).toBe(true)
  })

  it('still validates base schema (missing signatureFileId rejects)', () => {
    const bookingDate = new Date()
    const dob = dobForAge(25, bookingDate)
    const schema = makeWaiverSchema(dob, fmt(bookingDate))
    const result = schema.safeParse({
      waiverSignedAt: Date.now(),
      signatureFileId: '', // empty → fails min(1) check
    })
    expect(result.success).toBe(false)
  })

  it('calculates age at booking start date, not at current date', () => {
    // Diver is currently 17 but booking is 1 year from now → will be 18
    const now = new Date()
    const futureBooking = new Date(now)
    futureBooking.setFullYear(futureBooking.getFullYear() + 1)
    const dob = dobForAge(17, now) // 17 now, but 18 at future booking
    const schema = makeWaiverSchema(dob, fmt(futureBooking))
    const result = schema.safeParse(validWaiver())
    expect(result.success).toBe(true)
  })
})

// ── makeCustomerContactSchema — cert requirement conditional ─────────

describe('makeCustomerContactSchema', () => {
  /** Builds a complete valid contact data object. */
  function validContact(overrides: Record<string, unknown> = {}) {
    const bookingDate = new Date()
    const dob = new Date(bookingDate)
    dob.setFullYear(dob.getFullYear() - 25)
    const passportExpiry = new Date(bookingDate)
    passportExpiry.setFullYear(passportExpiry.getFullYear() + 5)

    return {
      legalFirstName: 'John',
      legalLastName: 'Doe',
      email: 'john@example.com',
      phone: '+1 555 000 1234',
      dateOfBirth: fmt(dob),
      gender: 'M' as const,
      nationality: 'US',
      passportNumber: 'A12345678',
      passportIssuingCountry: 'United States',
      passportExpirationDate: fmt(passportExpiry),
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '+1 555 000 5678',
      emergencyContactRelation: 'Spouse',
      ...overrides,
    }
  }

  it('passes without agency fields when no cert-required activities', () => {
    const schema = makeCustomerContactSchema(['DSD', 'TRY_DIVE'])
    const result = schema.safeParse(validContact())
    expect(result.success).toBe(true)
  })

  it('passes without agency fields when activity list is empty', () => {
    const schema = makeCustomerContactSchema([])
    const result = schema.safeParse(validContact())
    expect(result.success).toBe(true)
  })

  it('passes without agency fields when no activities provided (default)', () => {
    const schema = makeCustomerContactSchema()
    const result = schema.safeParse(validContact())
    expect(result.success).toBe(true)
  })

  it('fails without agency when cert-required activity is present', () => {
    const schema = makeCustomerContactSchema(['AOW'])
    const result = schema.safeParse(validContact())
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('agency')
      expect(paths).toContain('agencyID')
    }
  })

  it('passes with agency fields when cert-required activity is present', () => {
    const schema = makeCustomerContactSchema(['AOW'])
    const result = schema.safeParse(
      validContact({ agency: 'PADI', agencyID: 'CERT-123456' }),
    )
    expect(result.success).toBe(true)
  })

  it('fails when cert-required activity is mixed with non-cert and agency missing', () => {
    const schema = makeCustomerContactSchema(['DSD', 'RESCUE'])
    const result = schema.safeParse(validContact())
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('agency')
    }
  })
})
