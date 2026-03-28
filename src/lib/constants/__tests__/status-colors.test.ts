import { describe, it, expect } from 'vitest'
import {
  STATUS_COLORS,
  STATUS_OPACITY,
  STATUS_BORDER_STYLE,
  type CalendarDisplayStatus,
} from '../status-colors'

const ALL_STATUSES: CalendarDisplayStatus[] = [
  'Active',
  'Draft',
  'Upcoming',
  'Completed',
  'Cancelled',
  'Urgent',
]

describe('STATUS_OPACITY', () => {
  it('Draft opacity is 1.0 (solid)', () => {
    expect(STATUS_OPACITY['Draft']).toBe(1.0)
  })

  it('Upcoming opacity is 1.0 (full color)', () => {
    expect(STATUS_OPACITY['Upcoming']).toBe(1.0)
  })

  it('Completed opacity is < 1 and > 0 (muted)', () => {
    expect(STATUS_OPACITY['Completed']).toBeGreaterThan(0)
    expect(STATUS_OPACITY['Completed']).toBeLessThan(1)
    expect(STATUS_OPACITY['Completed']).toBe(0.6)
  })

  it('Cancelled opacity is 0 (hidden)', () => {
    expect(STATUS_OPACITY['Cancelled']).toBe(0)
  })

  it('Active and Urgent opacity are 1.0', () => {
    expect(STATUS_OPACITY['Active']).toBe(1.0)
    expect(STATUS_OPACITY['Urgent']).toBe(1.0)
  })

  it('has entries for all statuses', () => {
    for (const status of ALL_STATUSES) {
      expect(typeof STATUS_OPACITY[status]).toBe('number')
    }
  })
})

describe('STATUS_BORDER_STYLE', () => {
  it('Draft border is solid', () => {
    expect(STATUS_BORDER_STYLE['Draft']).toBe('solid')
  })

  it('Upcoming border is solid', () => {
    expect(STATUS_BORDER_STYLE['Upcoming']).toBe('solid')
  })

  it('all non-Draft statuses have solid borders', () => {
    const solidStatuses: CalendarDisplayStatus[] = ['Active', 'Upcoming', 'Completed', 'Cancelled', 'Urgent']
    for (const status of solidStatuses) {
      expect(STATUS_BORDER_STYLE[status]).toBe('solid')
    }
  })

  it('has entries for all statuses', () => {
    for (const status of ALL_STATUSES) {
      expect(typeof STATUS_BORDER_STYLE[status]).toBe('string')
    }
  })
})

describe('STATUS_COLORS', () => {
  it('exports color vars for all statuses', () => {
    for (const status of ALL_STATUSES) {
      const colors = STATUS_COLORS[status]
      expect(colors).not.toBeUndefined()
      expect(colors.bgVar).toBeTruthy()
      expect(colors.textVar).toBeTruthy()
      expect(colors.borderVar).toBeTruthy()
      expect(colors.dotVar).toBeTruthy()
    }
  })

  it('all color vars reference CSS custom properties', () => {
    for (const status of ALL_STATUSES) {
      const colors = STATUS_COLORS[status]
      expect(colors.bgVar).toMatch(/^var\(--/)
      expect(colors.textVar).toMatch(/^var\(--/)
      expect(colors.borderVar).toMatch(/^var\(--/)
    }
  })
})
