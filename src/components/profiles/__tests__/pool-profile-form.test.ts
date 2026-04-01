/**
 * Pool profile form — capability fields unit tests
 *
 * Tests the schema validation, payload transformation, and profile-to-form
 * mapping for the venue capability fields (confinedCapable, maxDepth, maxCapacity).
 */

import { describe, it, expect } from 'vitest'
import {
  poolSchema,
  INITIAL_POOL_FORM,
  poolFromProfile,
  poolToPayload,
  buildPoolCreatePayload,
} from '../pool-profile-form'
import type { PoolFormState } from '../pool-profile-form'

const VALID_LOCATION = {
  placeName: 'Blue Lagoon',
  country: 'Thailand',
  lat: 7.8804,
  lng: 98.3923,
}

function validForm(overrides: Partial<PoolFormState> = {}): PoolFormState {
  return {
    name: 'Test Pool',
    location: VALID_LOCATION,
    email: 'pool@example.com',
    phone: '+66 81 234 5678',
    maxDepth: 5,
    maxCapacity: 15,
    confinedCapable: true,
    ...overrides,
  }
}

// ── Schema validation ─────────────────────────────────────────────────────────

const validPoolForSchema = {
  name: 'Coral Pool',
  location: { placeName: 'Koh Tao', country: 'TH', lat: 10.1, lng: 99.8 },
  email: 'pool@test.com',
  phone: '+66812345678',
  maxDepth: 6,
  maxCapacity: 20,
  confinedCapable: true,
}

describe('poolSchema', () => {
  it('accepts form with confinedCapable true', () => {
    const result = poolSchema.safeParse(validForm())
    expect(result.success).toBe(true)
  })

  it('accepts form with confinedCapable false', () => {
    const result = poolSchema.safeParse(validForm({ confinedCapable: false }))
    expect(result.success).toBe(true)
  })

  it('accepts valid pool data (alternate fixture)', () => {
    expect(poolSchema.safeParse(validPoolForSchema).success).toBe(true)
  })

  it('rejects form missing confinedCapable', () => {
    const { confinedCapable: _, ...incomplete } = validForm()
    const result = poolSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    expect(poolSchema.safeParse({ ...validPoolForSchema, name: '' }).success).toBe(false)
  })

  it('rejects null location', () => {
    expect(poolSchema.safeParse({ ...validPoolForSchema, location: null }).success).toBe(false)
  })

  it('rejects invalid email', () => {
    expect(poolSchema.safeParse({ ...validPoolForSchema, email: 'not-email' }).success).toBe(false)
  })

  it('rejects zero maxDepth', () => {
    expect(poolSchema.safeParse({ ...validPoolForSchema, maxDepth: 0 }).success).toBe(false)
  })

  it('rejects negative maxCapacity', () => {
    expect(poolSchema.safeParse({ ...validPoolForSchema, maxCapacity: -1 }).success).toBe(false)
  })

  it('rejects non-integer maxCapacity', () => {
    expect(poolSchema.safeParse({ ...validPoolForSchema, maxCapacity: 5.5 }).success).toBe(false)
  })
})

// ── Initial form state ────────────────────────────────────────────────────────

describe('INITIAL_POOL_FORM', () => {
  it('includes confinedCapable with default false', () => {
    expect(INITIAL_POOL_FORM).toHaveProperty('confinedCapable', false)
  })

  it('has empty/zero defaults', () => {
    expect(INITIAL_POOL_FORM.name).toBe('')
    expect(INITIAL_POOL_FORM.location).toBeNull()
    expect(INITIAL_POOL_FORM.maxDepth).toBe(0)
    expect(INITIAL_POOL_FORM.maxCapacity).toBe(0)
    expect(INITIAL_POOL_FORM.confinedCapable).toBe(false)
  })
})

// ── fromProfile mapping ───────────────────────────────────────────────────────

describe('poolFromProfile', () => {
  it('maps confinedCapable from profile', () => {
    const profile = {
      name: 'Pool A',
      placeName: 'Bangkok',
      country: 'Thailand',
      lat: 13.7,
      lng: 100.5,
      email: 'a@b.com',
      phone: '+66 1',
      maxDepth: 3,
      maxCapacity: 10,
      confinedCapable: true,
    }
    const form = poolFromProfile(profile)
    expect(form.confinedCapable).toBe(true)
  })

  it('defaults confinedCapable to false when missing from profile', () => {
    const profile = {
      name: 'Pool B',
      placeName: 'Phuket',
      country: 'Thailand',
      lat: 7.9,
      lng: 98.4,
      email: 'b@c.com',
      phone: '+66 2',
      maxDepth: 5,
      maxCapacity: 20,
    }
    const form = poolFromProfile(profile)
    expect(form.confinedCapable).toBe(false)
  })

  it('extracts form state from profile record', () => {
    const profile = {
      name: 'Coral Pool',
      placeName: 'Koh Tao',
      country: 'TH',
      lat: 10.1,
      lng: 99.8,
      email: 'pool@test.com',
      phone: '+66812345678',
      maxDepth: 6,
      maxCapacity: 20,
      confinedCapable: true,
    }
    const form = poolFromProfile(profile)
    expect(form.name).toBe('Coral Pool')
    expect(form.location?.placeName).toBe('Koh Tao')
    expect(form.email).toBe('pool@test.com')
    expect(form.maxDepth).toBe(6)
    expect(form.confinedCapable).toBe(true)
  })

  it('defaults missing optional fields', () => {
    const form = poolFromProfile({ name: 'Test' })
    expect(form.email).toBe('')
    expect(form.phone).toBe('')
    expect(form.maxDepth).toBe(0)
    expect(form.confinedCapable).toBe(false)
  })
})

// ── toPayload ─────────────────────────────────────────────────────────────────

describe('poolToPayload', () => {
  it('includes confinedCapable in payload', () => {
    const payload = poolToPayload(validForm({ confinedCapable: true }))
    expect(payload.confinedCapable).toBe(true)
  })

  it('includes maxDepth and maxCapacity in payload', () => {
    const payload = poolToPayload(validForm({ maxDepth: 8.5, maxCapacity: 25 }))
    expect(payload.maxDepth).toBe(8.5)
    expect(payload.maxCapacity).toBe(25)
  })

  it('flattens location into top-level fields', () => {
    const form: PoolFormState = {
      ...INITIAL_POOL_FORM,
      name: 'Coral Pool',
      location: { placeName: 'Koh Tao', country: 'TH', lat: 10.1, lng: 99.8, placeId: 'abc' },
      email: 'pool@test.com',
      phone: '+66812345678',
      maxDepth: 6,
      maxCapacity: 20,
      confinedCapable: true,
    }
    const payload = poolToPayload(form)
    expect(payload.placeName).toBe('Koh Tao')
    expect(payload.country).toBe('TH')
    expect(payload.lat).toBe(10.1)
    expect(payload.lng).toBe(99.8)
    expect(payload.placeId).toBe('abc')
    expect(payload.name).toBe('Coral Pool')
    expect(payload.confinedCapable).toBe(true)
  })
})

// ── buildPoolCreatePayload ────────────────────────────────────────────────────

describe('buildPoolCreatePayload', () => {
  it('uses form confinedCapable value instead of hardcoded true', () => {
    const payload = buildPoolCreatePayload(
      poolToPayload(validForm({ confinedCapable: false })),
    )
    expect(payload.confinedCapable).toBe(false)
  })

  it('always sets venueType to Pool', () => {
    const payload = buildPoolCreatePayload(poolToPayload(validForm()))
    expect(payload.venueType).toBe('Pool')
  })

  it('always sets isPublic to false', () => {
    const payload = buildPoolCreatePayload(poolToPayload(validForm()))
    expect(payload.isPublic).toBe(false)
  })

  it('always sets hasCompressor to false', () => {
    const payload = buildPoolCreatePayload(poolToPayload(validForm()))
    expect(payload.hasCompressor).toBe(false)
  })

  it('adds venueType, isPublic, hasCompressor from minimal name payload', () => {
    const result = buildPoolCreatePayload({ name: 'Test' })
    expect(result.venueType).toBe('Pool')
    expect(result.isPublic).toBe(false)
    expect(result.hasCompressor).toBe(false)
  })

  it('preserves original payload fields', () => {
    const result = buildPoolCreatePayload({ name: 'Deep Pool', maxDepth: 12 })
    expect(result.name).toBe('Deep Pool')
    expect(result.maxDepth).toBe(12)
  })
})
