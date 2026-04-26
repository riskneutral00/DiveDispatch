import { describe, it, expect } from 'vitest'
import { buildResourceSubTabs } from '../preferences-editor'

const ALL_REQUIRED = {
  instructors: true,
  venues: true,
  boats: true,
  equipment: true,
  compressors: true,
  operator: false,
} as const

const NONE_REQUIRED = {
  instructors: false,
  venues: false,
  boats: false,
  equipment: false,
  compressors: false,
  operator: false,
} as const

describe('buildResourceSubTabs', () => {
  it('does not include a Readiness tab for any role', () => {
    const tabs = buildResourceSubTabs('DiveCenter')
    const ids = tabs.map((t) => t.id)
    expect(ids).not.toContain('readiness')
  })

  it('defaults first sub-tab to instructors', () => {
    const tabs = buildResourceSubTabs('DiveCenter')
    expect(tabs[0].id).toBe('instructors')
  })

  it('includes all resource sub-tabs for a non-Agent operator role', () => {
    const tabs = buildResourceSubTabs('DiveCenter')
    const ids = tabs.map((t) => t.id)
    expect(ids).toEqual(['instructors', 'venues', 'boats', 'equipment', 'compressors'])
  })

  it('appends Operator tab for Agent role', () => {
    const tabs = buildResourceSubTabs('Agent')
    const ids = tabs.map((t) => t.id)
    expect(ids).toEqual(['instructors', 'venues', 'boats', 'equipment', 'compressors', 'operator'])
  })

  it('does not include Operator tab for DiveCenter role', () => {
    const tabs = buildResourceSubTabs('DiveCenter')
    const ids = tabs.map((t) => t.id)
    expect(ids).not.toContain('operator')
  })

  it('does not include Operator tab when clerkRole is undefined', () => {
    const tabs = buildResourceSubTabs(undefined)
    const ids = tabs.map((t) => t.id)
    expect(ids).not.toContain('operator')
    expect(ids[0]).toBe('instructors')
  })

  it('returns labels matching the expected display strings', () => {
    const tabs = buildResourceSubTabs('DiveCenter')
    expect(tabs).toEqual([
      { id: 'instructors', label: 'Instructors', required: undefined },
      { id: 'venues', label: 'Venues', required: undefined },
      { id: 'boats', label: 'Boats', required: undefined },
      { id: 'equipment', label: 'Equipment', required: undefined },
      { id: 'compressors', label: 'Compressors', required: undefined },
    ])
  })

  it('marks all 5 resource tabs required when empty-form requirement map is passed', () => {
    const tabs = buildResourceSubTabs('DiveCenter', ALL_REQUIRED)
    expect(tabs).toEqual([
      { id: 'instructors', label: 'Instructors', required: true },
      { id: 'venues', label: 'Venues', required: true },
      { id: 'boats', label: 'Boats', required: true },
      { id: 'equipment', label: 'Equipment', required: true },
      { id: 'compressors', label: 'Compressors', required: true },
    ])
  })

  it('Operator tab never carries `required: true` even when other tabs are required', () => {
    const tabs = buildResourceSubTabs('Agent', ALL_REQUIRED)
    const operator = tabs.find((t) => t.id === 'operator')
    expect(operator).toBeDefined()
    expect(operator?.required).not.toBe(true)
  })

  it('clears asterisks when requirement map says nothing is required', () => {
    const tabs = buildResourceSubTabs('DiveCenter', NONE_REQUIRED)
    expect(tabs.every((t) => !t.required)).toBe(true)
  })
})
