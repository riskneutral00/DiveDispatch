import { describe, it, expect } from 'vitest'
import {
  poolSchema,
  buildPoolCreatePayload,
  poolToPayload,
  poolFromProfile,
  INITIAL_POOL_FORM,
  type PoolFormState,
} from '../src/components/profiles/pool-profile-form'

describe('poolSchema', () => {
  const validPool = {
    name: 'Coral Pool',
    location: { placeName: 'Koh Tao', country: 'TH', lat: 10.1, lng: 99.8 },
    email: 'pool@test.com',
    phone: '+66812345678',
    maxDepth: 6,
    maxCapacity: 20,
    confinedCapable: true,
  }

  it('accepts valid pool data', () => {
    expect(poolSchema.safeParse(validPool).success).toBe(true)
  })

  it('rejects missing name', () => {
    expect(poolSchema.safeParse({ ...validPool, name: '' }).success).toBe(false)
  })

  it('rejects null location', () => {
    expect(poolSchema.safeParse({ ...validPool, location: null }).success).toBe(false)
  })

  it('rejects invalid email', () => {
    expect(poolSchema.safeParse({ ...validPool, email: 'not-email' }).success).toBe(false)
  })

  it('rejects zero maxDepth', () => {
    expect(poolSchema.safeParse({ ...validPool, maxDepth: 0 }).success).toBe(false)
  })

  it('rejects negative maxCapacity', () => {
    expect(poolSchema.safeParse({ ...validPool, maxCapacity: -1 }).success).toBe(false)
  })

  it('rejects non-integer maxCapacity', () => {
    expect(poolSchema.safeParse({ ...validPool, maxCapacity: 5.5 }).success).toBe(false)
  })
})

describe('buildPoolCreatePayload', () => {
  it('adds venueType, isPublic, hasCompressor', () => {
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

describe('poolToPayload', () => {
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

describe('poolFromProfile', () => {
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

describe('INITIAL_POOL_FORM', () => {
  it('has empty/zero defaults', () => {
    expect(INITIAL_POOL_FORM.name).toBe('')
    expect(INITIAL_POOL_FORM.location).toBeNull()
    expect(INITIAL_POOL_FORM.maxDepth).toBe(0)
    expect(INITIAL_POOL_FORM.maxCapacity).toBe(0)
    expect(INITIAL_POOL_FORM.confinedCapable).toBe(false)
  })
})
