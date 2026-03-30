import { describe, it, expect } from 'vitest'
import {
  TOKEN_EXPIRED_MESSAGE,
  BOOKING_CLOSED_MESSAGE,
  UNEXPECTED_ERROR_MESSAGE,
  LINK_EXPIRED_LABEL,
  GENERATE_LINK_ERROR_MESSAGE,
  CANCEL_BOOKING_ERROR_MESSAGE,
  DISCARD_DRAFT_ERROR_MESSAGE,
} from '../src/lib/constants/error-messages'

describe('error messages', () => {
  it('all messages are non-empty strings', () => {
    const messages = [
      TOKEN_EXPIRED_MESSAGE,
      BOOKING_CLOSED_MESSAGE,
      UNEXPECTED_ERROR_MESSAGE,
      LINK_EXPIRED_LABEL,
      GENERATE_LINK_ERROR_MESSAGE,
      CANCEL_BOOKING_ERROR_MESSAGE,
      DISCARD_DRAFT_ERROR_MESSAGE,
    ]
    for (const msg of messages) {
      expect(typeof msg).toBe('string')
      expect(msg.length).toBeGreaterThan(0)
    }
  })

  it('TOKEN_EXPIRED_MESSAGE mentions contact', () => {
    expect(TOKEN_EXPIRED_MESSAGE.toLowerCase()).toContain('contact')
  })

  it('UNEXPECTED_ERROR_MESSAGE suggests trying again', () => {
    expect(UNEXPECTED_ERROR_MESSAGE.toLowerCase()).toContain('try again')
  })

  it('all retry messages contain "try again"', () => {
    const retryMessages = [
      UNEXPECTED_ERROR_MESSAGE,
      GENERATE_LINK_ERROR_MESSAGE,
      CANCEL_BOOKING_ERROR_MESSAGE,
      DISCARD_DRAFT_ERROR_MESSAGE,
    ]
    for (const msg of retryMessages) {
      expect(msg.toLowerCase()).toContain('try again')
    }
  })

  it('has exactly 7 exported messages', () => {
    const messages = [
      TOKEN_EXPIRED_MESSAGE,
      BOOKING_CLOSED_MESSAGE,
      UNEXPECTED_ERROR_MESSAGE,
      LINK_EXPIRED_LABEL,
      GENERATE_LINK_ERROR_MESSAGE,
      CANCEL_BOOKING_ERROR_MESSAGE,
      DISCARD_DRAFT_ERROR_MESSAGE,
    ]
    expect(messages).toHaveLength(7)
  })

  it('all messages have no leading/trailing whitespace', () => {
    const messages = [
      TOKEN_EXPIRED_MESSAGE,
      BOOKING_CLOSED_MESSAGE,
      UNEXPECTED_ERROR_MESSAGE,
      LINK_EXPIRED_LABEL,
      GENERATE_LINK_ERROR_MESSAGE,
      CANCEL_BOOKING_ERROR_MESSAGE,
      DISCARD_DRAFT_ERROR_MESSAGE,
    ]
    for (const msg of messages) {
      expect(msg).toBe(msg.trim())
    }
  })

  it('all messages end with a period', () => {
    const messages = [
      TOKEN_EXPIRED_MESSAGE,
      BOOKING_CLOSED_MESSAGE,
      UNEXPECTED_ERROR_MESSAGE,
      LINK_EXPIRED_LABEL,
      GENERATE_LINK_ERROR_MESSAGE,
      CANCEL_BOOKING_ERROR_MESSAGE,
      DISCARD_DRAFT_ERROR_MESSAGE,
    ]
    for (const msg of messages) {
      expect(msg.endsWith('.')).toBe(true)
    }
  })

  it('LINK_EXPIRED_LABEL is short (under 30 chars)', () => {
    expect(LINK_EXPIRED_LABEL.length).toBeLessThan(30)
  })

  it('BOOKING_CLOSED_MESSAGE mentions submissions', () => {
    expect(BOOKING_CLOSED_MESSAGE.toLowerCase()).toContain('submission')
  })
})
