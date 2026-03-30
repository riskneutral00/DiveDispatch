import { describe, it, expect } from 'vitest'
import {
  DEFAULT_LEGEND_STATUSES,
  DASHBOARD_CONFIGS,
} from '../src/lib/constants/dashboard-config'

describe('DEFAULT_LEGEND_STATUSES', () => {
  it('includes Active, Draft, Upcoming, Completed', () => {
    expect(DEFAULT_LEGEND_STATUSES).toContain('Active')
    expect(DEFAULT_LEGEND_STATUSES).toContain('Draft')
    expect(DEFAULT_LEGEND_STATUSES).toContain('Upcoming')
    expect(DEFAULT_LEGEND_STATUSES).toContain('Completed')
  })

  it('does not include Cancelled', () => {
    expect(DEFAULT_LEGEND_STATUSES).not.toContain('Cancelled')
  })
})

describe('DASHBOARD_CONFIGS', () => {
  it('is an object (may be empty)', () => {
    expect(typeof DASHBOARD_CONFIGS).toBe('object')
  })

  it('all config entries have valid legendStatuses if defined', () => {
    for (const [, config] of Object.entries(DASHBOARD_CONFIGS)) {
      if (config.legendStatuses) {
        expect(Array.isArray(config.legendStatuses)).toBe(true)
        for (const status of config.legendStatuses) {
          expect(typeof status).toBe('string')
          expect(status.length).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('DEFAULT_LEGEND_STATUSES', () => {
  it('has exactly 4 statuses', () => {
    expect(DEFAULT_LEGEND_STATUSES).toHaveLength(4)
  })

  it('has no duplicates', () => {
    expect(new Set(DEFAULT_LEGEND_STATUSES).size).toBe(DEFAULT_LEGEND_STATUSES.length)
  })

  it('all entries are non-empty strings', () => {
    for (const s of DEFAULT_LEGEND_STATUSES) {
      expect(typeof s).toBe('string')
      expect(s.length).toBeGreaterThan(0)
    }
  })
})
