import { describe, it, expect } from 'vitest'
import {
  COPY_FEEDBACK_MS,
  SAVE_FEEDBACK_MS,
  TOUCH_TOOLTIP_MS,
  PROFILE_BANNER_WINDOW_MS,
} from '../src/lib/constants/ui-timings'

describe('UI timing constants', () => {
  it('COPY_FEEDBACK_MS is a positive number', () => {
    expect(COPY_FEEDBACK_MS).toBeGreaterThan(0)
  })

  it('SAVE_FEEDBACK_MS is a positive number', () => {
    expect(SAVE_FEEDBACK_MS).toBeGreaterThan(0)
  })

  it('TOUCH_TOOLTIP_MS is a positive number', () => {
    expect(TOUCH_TOOLTIP_MS).toBeGreaterThan(0)
  })

  it('PROFILE_BANNER_WINDOW_MS is 7 days in ms', () => {
    expect(PROFILE_BANNER_WINDOW_MS).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('feedback timings are user-perceptible (>= 500ms, <= 5000ms)', () => {
    expect(COPY_FEEDBACK_MS).toBeGreaterThanOrEqual(500)
    expect(COPY_FEEDBACK_MS).toBeLessThanOrEqual(5000)
    expect(SAVE_FEEDBACK_MS).toBeGreaterThanOrEqual(500)
    expect(SAVE_FEEDBACK_MS).toBeLessThanOrEqual(5000)
  })

  it('touch tooltip is longer than copy/save feedback', () => {
    expect(TOUCH_TOOLTIP_MS).toBeGreaterThanOrEqual(COPY_FEEDBACK_MS)
  })
})
