import { describe, it, expect } from 'vitest'
import { PROFILE_REGISTRY } from '../src/lib/constants/profile-registry'

describe('PROFILE_REGISTRY', () => {
  it('has entries for all expected roles', () => {
    const roles = Object.keys(PROFILE_REGISTRY)
    expect(roles).toContain('dive-center')
    expect(roles).toContain('agent')
    expect(roles).toContain('instructor')
    expect(roles).toContain('dive-master')
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

  it('resource roles (boat, equipment, pool) have workspaceIncludesEmbeddedProfile true', () => {
    expect(PROFILE_REGISTRY.boat.workspaceIncludesEmbeddedProfile).toBe(true)
    expect(PROFILE_REGISTRY.equipment.workspaceIncludesEmbeddedProfile).toBe(true)
    expect(PROFILE_REGISTRY.pool.workspaceIncludesEmbeddedProfile).toBe(true)
  })

  it('compressor has tabs and workspaceIncludesEmbeddedProfile false', () => {
    expect(PROFILE_REGISTRY.compressor.tabs).not.toBeNull()
    expect(PROFILE_REGISTRY.compressor.tabs).toEqual([
      { id: 'contact', label: 'Contact' },
      { id: 'gas-mixes', label: 'Gas Mixes' },
    ])
    expect(PROFILE_REGISTRY.compressor.workspaceIncludesEmbeddedProfile).toBe(false)
  })

  it('operator roles have workspaceIncludesEmbeddedProfile false', () => {
    expect(PROFILE_REGISTRY['dive-center'].workspaceIncludesEmbeddedProfile).toBe(false)
    expect(PROFILE_REGISTRY.agent.workspaceIncludesEmbeddedProfile).toBe(false)
    expect(PROFILE_REGISTRY.instructor.workspaceIncludesEmbeddedProfile).toBe(false)
    expect(PROFILE_REGISTRY['dive-master'].workspaceIncludesEmbeddedProfile).toBe(false)
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
