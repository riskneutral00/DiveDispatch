import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  parseConvexError,
  getConvexErrorCode,
  mapPortalMutationError,
} from '../src/lib/utils/convex-error'
// Inline strings matching mapPortalMutationError output in convex-error.ts
const TOKEN_EXPIRED_MESSAGE = 'This link is no longer valid. Contact your dive center for a new one.'
const BOOKING_CLOSED_MESSAGE = 'This booking is closed. Contact your dive center for help.'
const UNEXPECTED_ERROR_MESSAGE = 'Something went wrong. Try again.'
const FORMS_INCOMPLETE_FALLBACK_MESSAGE = 'Complete all steps above before submitting.'

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
    expect(parseConvexError(new Error('random'))).toBe('Something went wrong. Try again.')
  })

  it('uses custom fallback for non-ConvexError', () => {
    expect(parseConvexError(new Error('random'), 'Custom fallback')).toBe('Custom fallback')
  })

  it('uses fallback for undefined', () => {
    expect(parseConvexError(undefined)).toBe('Something went wrong. Try again.')
  })

  it('uses fallback for null', () => {
    expect(parseConvexError(null)).toBe('Something went wrong. Try again.')
  })

  it('uses fallback for ConvexError with no recognized fields', () => {
    const err = new ConvexError({})
    expect(parseConvexError(err)).toBe('Something went wrong. Try again.')
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

describe('mapPortalMutationError', () => {
  it('maps TOKEN_EXPIRED', () => {
    expect(
      mapPortalMutationError(new ConvexError({ code: 'TOKEN_EXPIRED' })),
    ).toBe(TOKEN_EXPIRED_MESSAGE)
  })

  it('maps BOOKING_CLOSED', () => {
    expect(
      mapPortalMutationError(new ConvexError({ code: 'BOOKING_CLOSED' })),
    ).toBe(BOOKING_CLOSED_MESSAGE)
  })

  it('maps FORMS_INCOMPLETE with reason', () => {
    expect(
      mapPortalMutationError(
        new ConvexError({
          code: 'FORMS_INCOMPLETE',
          reason: 'Contact form not submitted',
        }),
      ),
    ).toBe('Incomplete: Contact form not submitted')
  })

  it('maps FORMS_INCOMPLETE without usable reason', () => {
    expect(
      mapPortalMutationError(new ConvexError({ code: 'FORMS_INCOMPLETE' })),
    ).toBe(FORMS_INCOMPLETE_FALLBACK_MESSAGE)
  })

  it('falls back like parseConvexError for other codes', () => {
    expect(
      mapPortalMutationError(new ConvexError({ code: 'SOMETHING_ELSE' })),
    ).toBe('SOMETHING_ELSE')
  })

  it('uses UNEXPECTED_ERROR_MESSAGE for non-ConvexError', () => {
    expect(mapPortalMutationError(new Error('network'))).toBe(
      UNEXPECTED_ERROR_MESSAGE,
    )
  })
})
