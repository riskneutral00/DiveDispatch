import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import { parseConvexError, getConvexErrorCode } from '../src/lib/utils/convex-error'

describe('parseConvexError', () => {
  it('extracts reason from ConvexError', () => {
    const err = new ConvexError({ code: 'CONFLICT', reason: 'Slot taken' })
    expect(parseConvexError(err)).toBe('Slot taken')
  })

  it('falls back to message when no reason', () => {
    const err = new ConvexError({ code: 'CONFLICT', message: 'Error occurred' })
    expect(parseConvexError(err)).toBe('Error occurred')
  })

  it('falls back to code when no reason or message', () => {
    const err = new ConvexError({ code: 'CONFLICT' })
    expect(parseConvexError(err)).toBe('CONFLICT')
  })

  it('uses default fallback for non-ConvexError', () => {
    expect(parseConvexError(new Error('random'))).toBe('Something went wrong. Please try again.')
  })

  it('uses custom fallback for non-ConvexError', () => {
    expect(parseConvexError(new Error('random'), 'Custom fallback')).toBe('Custom fallback')
  })

  it('uses fallback for undefined', () => {
    expect(parseConvexError(undefined)).toBe('Something went wrong. Please try again.')
  })

  it('uses fallback for null', () => {
    expect(parseConvexError(null)).toBe('Something went wrong. Please try again.')
  })

  it('uses fallback for ConvexError with no recognized fields', () => {
    const err = new ConvexError({})
    expect(parseConvexError(err)).toBe('Something went wrong. Please try again.')
  })
})

describe('getConvexErrorCode', () => {
  it('extracts code from ConvexError', () => {
    const err = new ConvexError({ code: 'CONFLICT' })
    expect(getConvexErrorCode(err)).toBe('CONFLICT')
  })

  it('returns undefined for non-ConvexError', () => {
    expect(getConvexErrorCode(new Error('random'))).toBeUndefined()
  })

  it('returns undefined when ConvexError has no code', () => {
    const err = new ConvexError({ reason: 'something' })
    expect(getConvexErrorCode(err)).toBeUndefined()
  })

  it('returns undefined for null', () => {
    expect(getConvexErrorCode(null)).toBeUndefined()
  })
})
