import { describe, it, expect } from 'vitest'
import { ErrorCode } from '../convex/lib/errorCodes'

describe('ErrorCode', () => {
  it('all values are unique strings', () => {
    const values = Object.values(ErrorCode)
    expect(new Set(values).size).toBe(values.length)
    for (const v of values) {
      expect(typeof v).toBe('string')
      expect(v.length).toBeGreaterThan(0)
    }
  })

  it('keys match values (convention: key === value)', () => {
    for (const [key, val] of Object.entries(ErrorCode)) {
      expect(key).toBe(val)
    }
  })

  it('has auth codes', () => {
    expect(ErrorCode.UNAUTHENTICATED).toBe('UNAUTHENTICATED')
    expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN')
  })

  it('has booking lifecycle codes', () => {
    expect(ErrorCode.BOOKING_CLOSED).toBe('BOOKING_CLOSED')
    expect(ErrorCode.PAST_DATE).toBe('PAST_DATE')
    expect(ErrorCode.CONFLICT).toBe('CONFLICT')
  })

  it('has portal codes', () => {
    expect(ErrorCode.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED')
    expect(ErrorCode.FORMS_INCOMPLETE).toBe('FORMS_INCOMPLETE')
  })

  it('has profile codes', () => {
    expect(ErrorCode.PROFILE_INCOMPLETE).toBe('PROFILE_INCOMPLETE')
    expect(ErrorCode.DUPLICATE_ROLE).toBe('DUPLICATE_ROLE')
  })

  it('has inventory codes', () => {
    expect(ErrorCode.ORPHANED_RESERVATION).toBe('ORPHANED_RESERVATION')
    expect(ErrorCode.MISSING_SNAPSHOT).toBe('MISSING_SNAPSHOT')
    expect(ErrorCode.CONFIRMED_RESERVATION_EXISTS).toBe('CONFIRMED_RESERVATION_EXISTS')
  })

  it('has validation codes', () => {
    expect(ErrorCode.VALIDATION).toBe('VALIDATION')
    expect(ErrorCode.INVALID_STATUS).toBe('INVALID_STATUS')
    expect(ErrorCode.INVALID_STATE).toBe('INVALID_STATE')
    expect(ErrorCode.INVALID_TRANSITION).toBe('INVALID_TRANSITION')
    expect(ErrorCode.INVALID_INPUT).toBe('INVALID_INPUT')
  })

  it('has rate limiting code', () => {
    expect(ErrorCode.RATE_LIMITED).toBe('RATE_LIMITED')
  })

  it('all values are UPPER_SNAKE_CASE', () => {
    for (const val of Object.values(ErrorCode)) {
      expect(val).toMatch(/^[A-Z_]+$/)
    }
  })

  it('has at least 20 error codes', () => {
    expect(Object.keys(ErrorCode).length).toBeGreaterThanOrEqual(20)
  })
})
