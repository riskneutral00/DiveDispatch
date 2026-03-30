import { describe, it, expect } from 'vitest'
import { getBarBorderColor, MULTIDAY_BORDER_VAR } from '../../src/lib/booking/bar-styles'

describe('getBarBorderColor', () => {
  const fallback = 'var(--fallback-border)'

  it('returns multiday border for Active multi-day booking', () => {
    expect(getBarBorderColor('Active', true, fallback)).toBe(MULTIDAY_BORDER_VAR)
  })

  it('returns multiday border for Draft multi-day booking', () => {
    expect(getBarBorderColor('Draft', true, fallback)).toBe(MULTIDAY_BORDER_VAR)
  })

  it('returns multiday border for Upcoming multi-day booking', () => {
    expect(getBarBorderColor('Upcoming', true, fallback)).toBe(MULTIDAY_BORDER_VAR)
  })

  it('returns multiday border for Urgent multi-day booking', () => {
    expect(getBarBorderColor('Urgent', true, fallback)).toBe(MULTIDAY_BORDER_VAR)
  })

  it('returns status border for Completed multi-day booking', () => {
    expect(getBarBorderColor('Completed', true, fallback)).toBe(fallback)
  })

  it('returns status border for Cancelled multi-day booking', () => {
    expect(getBarBorderColor('Cancelled', true, fallback)).toBe(fallback)
  })

  it('returns status border for single-day Active booking', () => {
    expect(getBarBorderColor('Active', false, fallback)).toBe(fallback)
  })

  it('returns status border for single-day Draft booking', () => {
    expect(getBarBorderColor('Draft', false, fallback)).toBe(fallback)
  })
})
