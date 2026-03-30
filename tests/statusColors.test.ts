import { describe, it, expect } from 'vitest'
import {
  LOCKING_STATUSES,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  STATUS_OPACITY,
  STATUS_BORDER_STYLE,
  STATUS_COLORS,
  type CalendarDisplayStatus,
} from '../src/lib/constants/status-colors'

const ALL_STATUSES: CalendarDisplayStatus[] = [
  'Active', 'Draft', 'Upcoming', 'Completed', 'Cancelled', 'Urgent',
]

describe('LOCKING_STATUSES', () => {
  it('includes Active, Upcoming, Completed', () => {
    expect(LOCKING_STATUSES.has('Active')).toBe(true)
    expect(LOCKING_STATUSES.has('Upcoming')).toBe(true)
    expect(LOCKING_STATUSES.has('Completed')).toBe(true)
  })

  it('does not include Draft or Cancelled', () => {
    expect(LOCKING_STATUSES.has('Draft')).toBe(false)
    expect(LOCKING_STATUSES.has('Cancelled')).toBe(false)
  })
})

describe('ACTIVE_STATUSES', () => {
  it('includes Draft and Upcoming', () => {
    expect(ACTIVE_STATUSES.has('Draft')).toBe(true)
    expect(ACTIVE_STATUSES.has('Upcoming')).toBe(true)
  })

  it('does not include Completed or Cancelled', () => {
    expect(ACTIVE_STATUSES.has('Completed')).toBe(false)
    expect(ACTIVE_STATUSES.has('Cancelled')).toBe(false)
  })
})

describe('TERMINAL_STATUSES', () => {
  it('includes Cancelled and Completed', () => {
    expect(TERMINAL_STATUSES.has('Cancelled')).toBe(true)
    expect(TERMINAL_STATUSES.has('Completed')).toBe(true)
  })

  it('does not include Draft or Upcoming', () => {
    expect(TERMINAL_STATUSES.has('Draft')).toBe(false)
    expect(TERMINAL_STATUSES.has('Upcoming')).toBe(false)
  })
})

describe('STATUS_OPACITY', () => {
  it('Cancelled has opacity 0', () => {
    expect(STATUS_OPACITY['Cancelled']).toBe(0)
  })

  it('Completed has reduced opacity', () => {
    expect(STATUS_OPACITY['Completed']).toBeLessThan(1)
  })

  it('Active statuses have full opacity', () => {
    expect(STATUS_OPACITY['Active']).toBe(1.0)
    expect(STATUS_OPACITY['Draft']).toBe(1.0)
    expect(STATUS_OPACITY['Upcoming']).toBe(1.0)
  })

  it('has entry for every CalendarDisplayStatus', () => {
    for (const status of ALL_STATUSES) {
      expect(STATUS_OPACITY[status]).toBeDefined()
    }
  })
})

describe('STATUS_BORDER_STYLE', () => {
  it('has entry for every CalendarDisplayStatus', () => {
    for (const status of ALL_STATUSES) {
      expect(['solid', 'dashed']).toContain(STATUS_BORDER_STYLE[status])
    }
  })
})

describe('STATUS_COLORS', () => {
  it('has CSS variable entries for every status', () => {
    for (const status of ALL_STATUSES) {
      const entry = STATUS_COLORS[status]
      expect(entry.textVar).toMatch(/^var\(--/)
      expect(entry.bgVar).toMatch(/^var\(--/)
      expect(entry.borderVar).toMatch(/^var\(--/)
      expect(entry.dotVar).toMatch(/^var\(--/)
    }
  })

  it('status-specific vars contain the status name', () => {
    expect(STATUS_COLORS['Draft'].textVar).toContain('draft')
    expect(STATUS_COLORS['Urgent'].bgVar).toContain('urgent')
  })
})
