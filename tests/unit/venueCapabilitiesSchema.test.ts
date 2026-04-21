import { describe, it, expect } from 'vitest'
import { venueCapabilitiesSchema } from '../../src/lib/schemas/profile-shared'

describe('venueCapabilitiesSchema — pool branch (required)', () => {
  const VALID_POOL = { subtype: 'pool' as const, maxDepth: 2.5, maxCapacity: 5 }

  it('accepts a valid pool payload', () => {
    expect(venueCapabilitiesSchema.safeParse(VALID_POOL).success).toBe(true)
  })

  it('rejects pool without maxDepth', () => {
    const { maxDepth: _omit, ...rest } = VALID_POOL
    const result = venueCapabilitiesSchema.safeParse(rest)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'maxDepth')).toBe(true)
    }
  })

  it('rejects pool without maxCapacity', () => {
    const { maxCapacity: _omit, ...rest } = VALID_POOL
    const result = venueCapabilitiesSchema.safeParse(rest)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'maxCapacity')).toBe(true)
    }
  })

  it('rejects pool maxDepth over 60 m', () => {
    const result = venueCapabilitiesSchema.safeParse({ ...VALID_POOL, maxDepth: 61 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'Pool max depth is 60 m')).toBe(true)
    }
  })

  it('rejects pool maxDepth not in 0.5 m increments', () => {
    const result = venueCapabilitiesSchema.safeParse({ ...VALID_POOL, maxDepth: 2.3 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'Must be in 0.5 m increments')).toBe(true)
    }
  })

  it('accepts pool maxDepth exactly at 60 m', () => {
    expect(venueCapabilitiesSchema.safeParse({ ...VALID_POOL, maxDepth: 60 }).success).toBe(true)
  })

  it('rejects pool maxCapacity over 50', () => {
    const result = venueCapabilitiesSchema.safeParse({ ...VALID_POOL, maxCapacity: 51 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'Pool max capacity is 50')).toBe(true)
    }
  })

  it('rejects pool maxCapacity not an integer', () => {
    const result = venueCapabilitiesSchema.safeParse({ ...VALID_POOL, maxCapacity: 5.5 })
    expect(result.success).toBe(false)
  })
})

describe('venueCapabilitiesSchema — non-pool subtypes (optional)', () => {
  it('accepts shore without caps', () => {
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'shore' }).success).toBe(true)
  })

  it('accepts reef with only maxDepth', () => {
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'reef', maxDepth: 30 }).success).toBe(true)
  })

  it('accepts other with only maxCapacity', () => {
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'other', maxCapacity: 50 }).success).toBe(true)
  })

  it('allows non-pool caps above pool-specific ceiling (e.g. reef 40m)', () => {
    expect(venueCapabilitiesSchema.safeParse({ subtype: 'reef', maxDepth: 40, maxCapacity: 25 }).success).toBe(true)
  })
})
