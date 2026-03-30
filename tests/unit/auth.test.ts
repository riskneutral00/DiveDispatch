import { describe, it, expect } from 'vitest'
import { assertOwnership, OPERATOR_ROLE_SET, HOLD_TTL_MS } from '../../convex/lib/auth'

describe('assertOwnership', () => {
  it('does not throw when ownerId matches user slug', () => {
    expect(() =>
      assertOwnership({ ownerId: 'jane-dc' }, { slug: 'jane-dc' }),
    ).not.toThrow()
  })

  it('throws FORBIDDEN when ownerId does not match', () => {
    expect(() =>
      assertOwnership({ ownerId: 'jane-dc' }, { slug: 'bob-dc' }),
    ).toThrow()
  })

  it('includes custom reason in error when provided', () => {
    try {
      assertOwnership({ ownerId: 'a' }, { slug: 'b' }, 'Not your resource')
      expect.fail('should have thrown')
    } catch (err: unknown) {
      expect((err as { data: { reason: string } }).data.reason).toBe('Not your resource')
    }
  })

  it('throws for empty slug mismatch', () => {
    expect(() =>
      assertOwnership({ ownerId: 'jane' }, { slug: '' }),
    ).toThrow()
  })
})

describe('OPERATOR_ROLE_SET', () => {
  it('contains DiveCenter and Agent', () => {
    expect(OPERATOR_ROLE_SET.has('DiveCenter')).toBe(true)
    expect(OPERATOR_ROLE_SET.has('Agent')).toBe(true)
  })

  it('does not contain resource roles', () => {
    expect(OPERATOR_ROLE_SET.has('Instructor')).toBe(false)
    expect(OPERATOR_ROLE_SET.has('Boat')).toBe(false)
    expect(OPERATOR_ROLE_SET.has('Equipment')).toBe(false)
  })
})

describe('HOLD_TTL_MS', () => {
  it('equals 12 hours in milliseconds', () => {
    expect(HOLD_TTL_MS).toBe(12 * 60 * 60 * 1000)
  })
})
