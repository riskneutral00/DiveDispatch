/**
 * preferences-editor — buildResourceSubTabs unit tests
 *
 * Verifies the resource sub-tab configuration after DD-455:
 * - Readiness tab is removed
 * - Default first tab is Instructors
 * - Agent role gets an additional Operator tab
 * - Non-Agent roles do not get the Operator tab
 */

import { describe, it, expect } from 'vitest'
import { buildResourceSubTabs } from '../preferences-editor'

describe('buildResourceSubTabs', () => {
  it('does not include a Readiness tab for any role', () => {
    const tabs = buildResourceSubTabs('DiveCenter')
    const ids = tabs.map((t) => t.id)
    expect(ids).not.toContain('readiness')
  })

  it('defaults first sub-tab to instructors (not readiness)', () => {
    const tabs = buildResourceSubTabs('DiveCenter')
    expect(tabs[0].id).toBe('instructors')
  })

  it('includes all resource sub-tabs for a non-Agent operator role', () => {
    const tabs = buildResourceSubTabs('DiveCenter')
    const ids = tabs.map((t) => t.id)
    expect(ids).toEqual(['instructors', 'venues-boats', 'equipment', 'compressors'])
  })

  it('appends Operator tab for Agent role', () => {
    const tabs = buildResourceSubTabs('Agent')
    const ids = tabs.map((t) => t.id)
    expect(ids).toEqual(['instructors', 'venues-boats', 'equipment', 'compressors', 'operator'])
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
      { id: 'instructors', label: 'Instructors' },
      { id: 'venues-boats', label: 'Venues & Boats' },
      { id: 'equipment', label: 'Equipment' },
      { id: 'compressors', label: 'Compressors' },
    ])
  })
})
