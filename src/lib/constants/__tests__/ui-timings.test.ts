import { describe, it, expect } from 'vitest'
import {
  COPY_FEEDBACK_MS,
  SAVE_FEEDBACK_MS,
  INLINE_SAVED_FLASH_MS,
  AUTOCOMPLETE_DISMISS_MS,
  TOUCH_TOOLTIP_MS,
  PORTAL_LINK_EXPIRY_MS,
  PROFILE_BANNER_WINDOW_MS,
} from '../ui-timings'

describe('ui-timings constants', () => {
  it('COPY_FEEDBACK_MS is 2 seconds', () => {
    expect(COPY_FEEDBACK_MS).toBe(2000)
  })

  it('SAVE_FEEDBACK_MS is 2 seconds', () => {
    expect(SAVE_FEEDBACK_MS).toBe(2000)
  })

  it('INLINE_SAVED_FLASH_MS is 1.5 seconds (used by inline mutation flash, distinct from SAVE_FEEDBACK_MS)', () => {
    expect(INLINE_SAVED_FLASH_MS).toBe(1500)
    expect(INLINE_SAVED_FLASH_MS).not.toBe(SAVE_FEEDBACK_MS)
  })

  it('AUTOCOMPLETE_DISMISS_MS is 150ms (autocomplete blur dismissal)', () => {
    expect(AUTOCOMPLETE_DISMISS_MS).toBe(150)
  })

  it('TOUCH_TOOLTIP_MS is 3 seconds', () => {
    expect(TOUCH_TOOLTIP_MS).toBe(3000)
  })

  it('PORTAL_LINK_EXPIRY_MS is exactly 30 days in ms', () => {
    expect(PORTAL_LINK_EXPIRY_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })

  it('PROFILE_BANNER_WINDOW_MS is exactly 7 days in ms', () => {
    expect(PROFILE_BANNER_WINDOW_MS).toBe(7 * 24 * 60 * 60 * 1000)
  })
})
