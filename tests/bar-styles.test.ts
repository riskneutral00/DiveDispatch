import { describe, it, expect } from 'vitest'
import { getBarBorderColor, MULTIDAY_BORDER_VAR } from '../src/lib/booking/bar-styles'

const STATUS_BORDER = 'var(--color-status-draft-border)'

describe('getBarBorderColor', () => {
  it('single-day Draft → uses status border color', () => {
    expect(getBarBorderColor('Draft', false, STATUS_BORDER)).toBe(STATUS_BORDER)
  })

  it('multi-day Draft → uses multiday border var', () => {
    expect(getBarBorderColor('Draft', true, STATUS_BORDER)).toBe(MULTIDAY_BORDER_VAR)
  })

  it('multi-day Upcoming → uses multiday border var', () => {
    expect(getBarBorderColor('Upcoming', true, STATUS_BORDER)).toBe(MULTIDAY_BORDER_VAR)
  })

  it('multi-day Active → uses multiday border var', () => {
    expect(getBarBorderColor('Active', true, STATUS_BORDER)).toBe(MULTIDAY_BORDER_VAR)
  })

  it('multi-day Urgent → uses multiday border var', () => {
    expect(getBarBorderColor('Urgent', true, STATUS_BORDER)).toBe(MULTIDAY_BORDER_VAR)
  })

  it('multi-day Completed → uses status border color (no multiday override)', () => {
    expect(getBarBorderColor('Completed', true, STATUS_BORDER)).toBe(STATUS_BORDER)
  })

  it('single-day Upcoming → uses status border color', () => {
    expect(getBarBorderColor('Upcoming', false, STATUS_BORDER)).toBe(STATUS_BORDER)
  })
})
