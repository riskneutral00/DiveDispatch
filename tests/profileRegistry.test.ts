import { describe, it, expect } from 'vitest'
import { PROFILE_REGISTRY } from '../src/lib/constants/profile-registry'

describe('PROFILE_REGISTRY', () => {
  it('has entries for all expected roles', () => {
    const roles = Object.keys(PROFILE_REGISTRY)
    expect(roles).toContain('dive-center')
    expect(roles).toContain('agent')
    expect(roles).toContain('instructor')
    expect(roles).toContain('boat')
    expect(roles).toContain('compressor')
    expect(roles).toContain('equipment')
    expect(roles).toContain('pool')
  })

  it('all entries have non-empty labels', () => {
    for (const [, config] of Object.entries(PROFILE_REGISTRY)) {
      expect(config.label.length).toBeGreaterThan(0)
    }
  })

  it('tabs are either null or non-empty array', () => {
    for (const [, config] of Object.entries(PROFILE_REGISTRY)) {
      if (config.tabs !== null) {
        expect(Array.isArray(config.tabs)).toBe(true)
        expect(config.tabs.length).toBeGreaterThan(0)
      }
    }
  })

  it('all tab entries have id and label', () => {
    for (const [, config] of Object.entries(PROFILE_REGISTRY)) {
      if (config.tabs) {
        for (const tab of config.tabs) {
          expect(tab.id.length).toBeGreaterThan(0)
          expect(tab.label.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('operator roles (dive-center, agent) have tabs', () => {
    expect(PROFILE_REGISTRY['dive-center'].tabs).not.toBeNull()
    expect(PROFILE_REGISTRY.agent.tabs).not.toBeNull()
  })

  it('pool has tabs', () => {
    expect(PROFILE_REGISTRY.pool.tabs).not.toBeNull()
    expect(PROFILE_REGISTRY.pool.tabs).toEqual([
      { id: 'contact', label: 'Contact' },
      { id: 'capabilities', label: 'Capabilities' },
      { id: 'booking', label: 'Booking' },
    ])
  })

  it('equipment has tabs', () => {
    expect(PROFILE_REGISTRY.equipment.tabs).not.toBeNull()
    expect(PROFILE_REGISTRY.equipment.tabs).toEqual([
      { id: 'contact', label: 'Contact' },
      { id: 'gear', label: 'Gear' },
      { id: 'booking', label: 'Booking' },
    ])
  })

  it('compressor has tabs', () => {
    expect(PROFILE_REGISTRY.compressor.tabs).not.toBeNull()
    expect(PROFILE_REGISTRY.compressor.tabs).toEqual([
      { id: 'contact', label: 'Contact' },
      { id: 'gas-mixes', label: 'Gas Mixes' },
      { id: 'booking', label: 'Booking' },
    ])
  })

  it('boat has contact, fleet, booking tabs', () => {
    expect(PROFILE_REGISTRY.boat.tabs).toEqual([
      { id: 'contact', label: 'Contact' },
      { id: 'fleet', label: 'Fleet' },
      { id: 'booking', label: 'Booking' },
    ])
  })

  it('no duplicate tab IDs within any role', () => {
    for (const [, config] of Object.entries(PROFILE_REGISTRY)) {
      if (config.tabs) {
        const ids = config.tabs.map((t) => t.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })
})
