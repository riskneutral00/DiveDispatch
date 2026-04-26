import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import { extractErrorCode, ISOLATABLE_ERRORS, ErrorCode } from '../../convex/lib/errorCodes'

describe('extractErrorCode', () => {
  it('extracts code from ConvexError with object data', () => {
    const err = new ConvexError({ code: 'NOT_FOUND' })
    expect(extractErrorCode(err)).toBe('NOT_FOUND')
  })

  it('extracts code from ConvexError with JSON-serialized string data', () => {
    const err = new ConvexError(JSON.stringify({ code: 'FORBIDDEN' }))
    expect(extractErrorCode(err)).toBe('FORBIDDEN')
  })

  it('returns UNKNOWN for non-ConvexError', () => {
    expect(extractErrorCode(new Error('oops'))).toBe('UNKNOWN')
    expect(extractErrorCode('string error')).toBe('UNKNOWN')
    expect(extractErrorCode(null)).toBe('UNKNOWN')
    expect(extractErrorCode(undefined)).toBe('UNKNOWN')
  })

  it('returns UNKNOWN for ConvexError with non-parseable string data', () => {
    const err = new ConvexError('just a string')
    expect(extractErrorCode(err)).toBe('UNKNOWN')
  })

  it('returns UNKNOWN for ConvexError with no code field', () => {
    const err = new ConvexError({ message: 'no code here' })
    expect(extractErrorCode(err)).toBe('UNKNOWN')
  })

  it('returns UNKNOWN for ConvexError with non-string code', () => {
    const err = new ConvexError({ code: 123 })
    expect(extractErrorCode(err)).toBe('UNKNOWN')
  })
})

describe('ISOLATABLE_ERRORS', () => {
  it('contains exactly the expected safe-to-isolate error codes', () => {
    expect(ISOLATABLE_ERRORS.has(ErrorCode.ORPHANED_RESERVATION)).toBe(true)
    expect(ISOLATABLE_ERRORS.has(ErrorCode.MISSING_SNAPSHOT)).toBe(true)
    expect(ISOLATABLE_ERRORS.has(ErrorCode.MISSING_SNAPSHOT_ON_RELEASE)).toBe(true)
    expect(ISOLATABLE_ERRORS.has(ErrorCode.INVARIANT_VIOLATION)).toBe(true)
    expect(ISOLATABLE_ERRORS.size).toBe(4)
  })

  it('does not contain dangerous error codes that should abort batches', () => {
    expect(ISOLATABLE_ERRORS.has(ErrorCode.SNAPSHOT_UNDERFLOW)).toBe(false)
    expect(ISOLATABLE_ERRORS.has(ErrorCode.SNAPSHOT_DOUBLE_WRITE)).toBe(false)
  })
})
