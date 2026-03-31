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

describe('poolSchema', () => {
  it('accepts form with confinedCapable true', () => {
    const result = poolSchema.safeParse(validForm())
    expect(result.success).toBe(true)
  })

  it('accepts form with confinedCapable false', () => {
    const result = poolSchema.safeParse(validForm({ confinedCapable: false }))
    expect(result.success).toBe(true)
  })

  it('rejects form missing confinedCapable', () => {
    const { confinedCapable: _, ...incomplete } = validForm()
    const result = poolSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })
})

// ── Initial form state ────────────────────────────────────────────────────────

describe('INITIAL_POOL_FORM', () => {
  it('includes confinedCapable with default false', () => {
    expect(INITIAL_POOL_FORM).toHaveProperty('confinedCapable', false)
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
})
