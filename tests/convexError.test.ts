import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import { parseConvexError, getConvexErrorCode } from '../src/lib/utils/convex-error'

describe('parseConvexError', () => {
  it('extracts reason from ConvexError', () => {
    const err = new ConvexError({ code: 'NOT_FOUND', reason: 'User not found' })
    expect(parseConvexError(err)).toBe('User not found')
  })

  it('falls back to message when no reason', () => {
    const err = new ConvexError({ message: 'Something happened' })
    expect(parseConvexError(err)).toBe('Something happened')
  })

  it('falls back to code when no reason or message', () => {
    const err = new ConvexError({ code: 'FORBIDDEN' })
    expect(parseConvexError(err)).toBe('FORBIDDEN')
  })

  it('returns default fallback for non-ConvexError', () => {
    expect(parseConvexError(new Error('generic'))).toBe('Something went wrong. Please try again.')
  })

  it('returns custom fallback for non-ConvexError', () => {
    expect(parseConvexError(new Error('nope'), 'Custom fallback')).toBe('Custom fallback')
  })
})

describe('getConvexErrorCode', () => {
  it('extracts code from ConvexError', () => {
    const err = new ConvexError({ code: 'FORBIDDEN', reason: 'Nope' })
    expect(getConvexErrorCode(err)).toBe('FORBIDDEN')
  })

  it('returns undefined for non-ConvexError', () => {
    expect(getConvexErrorCode(new Error('generic'))).toBeUndefined()
  })

  it('returns undefined when ConvexError has no code', () => {
    const err = new ConvexError({ reason: 'just a reason' })
    expect(getConvexErrorCode(err)).toBeUndefined()
  })
})
