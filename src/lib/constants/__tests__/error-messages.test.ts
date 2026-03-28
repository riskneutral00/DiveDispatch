import { describe, it, expect } from 'vitest'
import {
  TOKEN_EXPIRED_MESSAGE,
  BOOKING_CLOSED_MESSAGE,
  UNEXPECTED_ERROR_MESSAGE,
  LINK_EXPIRED_LABEL,
  GENERATE_LINK_ERROR_MESSAGE,
  CANCEL_BOOKING_ERROR_MESSAGE,
  DISCARD_DRAFT_ERROR_MESSAGE,
} from '../error-messages'

describe('error-messages constants', () => {
  describe('TOKEN_EXPIRED_MESSAGE', () => {
    it('mentions the link expiry', () => {
      expect(TOKEN_EXPIRED_MESSAGE).toContain('expired')
    })

    it('directs user to contact dive center', () => {
      expect(TOKEN_EXPIRED_MESSAGE).toContain('dive center')
    })

    it('is a non-empty string', () => {
      expect(typeof TOKEN_EXPIRED_MESSAGE).toBe('string')
      expect(TOKEN_EXPIRED_MESSAGE.length).toBeGreaterThan(0)
    })
  })

  describe('BOOKING_CLOSED_MESSAGE', () => {
    it('communicates that submissions are no longer accepted', () => {
      expect(BOOKING_CLOSED_MESSAGE.toLowerCase()).toContain('no longer')
    })

    it('is a non-empty string', () => {
      expect(typeof BOOKING_CLOSED_MESSAGE).toBe('string')
      expect(BOOKING_CLOSED_MESSAGE.length).toBeGreaterThan(0)
    })
  })

  describe('UNEXPECTED_ERROR_MESSAGE', () => {
    it('contains "Please try again"', () => {
      expect(UNEXPECTED_ERROR_MESSAGE).toContain('Please try again')
    })

    it('is a non-empty string', () => {
      expect(typeof UNEXPECTED_ERROR_MESSAGE).toBe('string')
      expect(UNEXPECTED_ERROR_MESSAGE.length).toBeGreaterThan(0)
    })
  })

  describe('LINK_EXPIRED_LABEL', () => {
    it('is shorter than TOKEN_EXPIRED_MESSAGE (label usage)', () => {
      expect(LINK_EXPIRED_LABEL.length).toBeLessThan(TOKEN_EXPIRED_MESSAGE.length)
    })

    it('mentions "expired"', () => {
      expect(LINK_EXPIRED_LABEL.toLowerCase()).toContain('expired')
    })
  })

  describe('GENERATE_LINK_ERROR_MESSAGE', () => {
    it('mentions generating a link', () => {
      expect(GENERATE_LINK_ERROR_MESSAGE.toLowerCase()).toContain('link')
    })

    it('contains "Please try again"', () => {
      expect(GENERATE_LINK_ERROR_MESSAGE).toContain('Please try again')
    })
  })

  describe('CANCEL_BOOKING_ERROR_MESSAGE', () => {
    it('mentions cancel', () => {
      expect(CANCEL_BOOKING_ERROR_MESSAGE.toLowerCase()).toContain('cancel')
    })

    it('contains "Please try again"', () => {
      expect(CANCEL_BOOKING_ERROR_MESSAGE).toContain('Please try again')
    })
  })

  describe('DISCARD_DRAFT_ERROR_MESSAGE', () => {
    it('mentions discard', () => {
      expect(DISCARD_DRAFT_ERROR_MESSAGE.toLowerCase()).toContain('discard')
    })

    it('contains "Please try again"', () => {
      expect(DISCARD_DRAFT_ERROR_MESSAGE).toContain('Please try again')
    })
  })

  describe('uniqueness — each constant has distinct wording', () => {
    const all = [
      TOKEN_EXPIRED_MESSAGE,
      BOOKING_CLOSED_MESSAGE,
      UNEXPECTED_ERROR_MESSAGE,
      LINK_EXPIRED_LABEL,
      GENERATE_LINK_ERROR_MESSAGE,
      CANCEL_BOOKING_ERROR_MESSAGE,
      DISCARD_DRAFT_ERROR_MESSAGE,
    ]

    it('no two constants are identical', () => {
      const unique = new Set(all)
      expect(unique.size).toBe(all.length)
    })
  })
})
