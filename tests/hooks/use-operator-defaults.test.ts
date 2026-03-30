// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

let mockCurrentUser = { isLoading: false }

// Track useQuery calls by order — the hook calls:
// 1. api.userRoles.myRoles
// 2. api.stakeholderPreferences.mine
// 3. api.diveCenters.mine (or skip)
// 4. api.agents.mine (or skip)
let queryCallIndex = 0
let queryReturns: unknown[] = []

vi.mock('../../src/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => mockCurrentUser,
}))

vi.mock('convex/react', () => ({
  useQuery: (_ref: unknown, args?: unknown) => {
    if (args === 'skip') return undefined
    const idx = queryCallIndex++
    return queryReturns[idx]
  },
}))

import { useOperatorDefaults } from '../../src/lib/hooks/use-operator-defaults'

describe('useOperatorDefaults', () => {
  beforeEach(() => {
    queryCallIndex = 0
    queryReturns = []
    mockCurrentUser = { isLoading: false }
  })

  it('isLoading=true when user is loading', () => {
    mockCurrentUser = { isLoading: true }
    queryReturns = [undefined, undefined] // myRoles, prefs
    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.isLoading).toBe(true)
  })

  it('isLoading=true when userRoles is undefined', () => {
    queryReturns = [undefined, undefined] // myRoles loading, prefs loading
    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.isLoading).toBe(true)
  })

  it('returns empty defaults when prefs is null', () => {
    queryReturns = [[], null] // myRoles=[], prefs=null
    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults).toEqual({
      agency: '',
      preferredInstructorSlug: '',
      preferredVenueSlug: '',
      preferredBoatSlug: '',
      preferredEquipmentSlug: '',
      preferredCompressorSlug: '',
    })
  })

  it('derives first slug from each preference array', () => {
    queryReturns = [
      [], // myRoles (no DC or Agent)
      {   // prefs
        preferredInstructorSlugs: ['instr-a', 'instr-b'],
        preferredVenueSlugs: ['venue-x'],
        preferredBoatSlugs: ['boat-1'],
        preferredEquipmentSlugs: ['eq-1'],
        preferredCompressorSlugs: ['comp-1'],
      },
    ]
    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults.preferredInstructorSlug).toBe('instr-a')
    expect(result.current.defaults.preferredVenueSlug).toBe('venue-x')
    expect(result.current.defaults.preferredBoatSlug).toBe('boat-1')
    expect(result.current.defaults.preferredEquipmentSlug).toBe('eq-1')
    expect(result.current.defaults.preferredCompressorSlug).toBe('comp-1')
  })

  it('defaults to empty string for missing/empty preference arrays', () => {
    queryReturns = [
      [],
      {
        preferredInstructorSlugs: [],
        preferredVenueSlugs: undefined,
        preferredBoatSlugs: null,
      },
    ]
    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults.preferredInstructorSlug).toBe('')
    expect(result.current.defaults.preferredVenueSlug).toBe('')
    expect(result.current.defaults.preferredBoatSlug).toBe('')
  })

  it('isLoading=false when no DC/Agent roles and queries resolved', () => {
    queryReturns = [
      [{ role: 'Customer' }], // myRoles
      { preferredInstructorSlugs: [] }, // prefs
    ]
    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.isLoading).toBe(false)
  })

  it('derives agency from DC profile associations', () => {
    queryReturns = [
      [{ role: 'DiveCenter' }], // myRoles — hasDC=true
      { preferredInstructorSlugs: [] }, // prefs
      { associations: [{ agency: 'PADI' }, { agency: 'SSI' }] }, // dcProfile
    ]
    const { result } = renderHook(() => useOperatorDefaults())
    expect(result.current.defaults.agency).toBe('PADI')
  })
})
