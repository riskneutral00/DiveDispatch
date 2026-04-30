/**
 * @vitest-environment jsdom
 * @module-tag slow
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  VENUE_SIGNUP_INTENT_STORAGE_KEY,
  collapseSignupTilesToRoles,
  getSignupResourceTiles,
  type SignupRoleTileConfig,
} from '../../src/lib/constants/signup-role-tiles'
import {
  useVenueSignupIntent,
  clearStoredVenueSignupIntent,
} from '../../src/lib/hooks/use-venue-signup-intent'
import { deriveDefaultRole } from '../../convex/lib/rolePrecedence'

function setIntent(value: string) {
  window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, value)
}

function readIntent(): string | null {
  return window.sessionStorage.getItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)
}

describe('walkthrough: venue signup intent lifecycle', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('valid intent survives first dashboard/onboarding read', () => {
    setIntent('pool')
    const { result } = renderHook(() => useVenueSignupIntent())
    expect(result.current).toBe('pool')
    expect(readIntent()).toBe('pool')
  })

  it('refresh before completion preserves intent (re-mount still reads value)', () => {
    setIntent('pool')
    const first = renderHook(() => useVenueSignupIntent())
    expect(first.result.current).toBe('pool')
    first.unmount()

    const second = renderHook(() => useVenueSignupIntent())
    expect(second.result.current).toBe('pool')
    expect(readIntent()).toBe('pool')
  })

  it('"dive_site" intent survives first dashboard/onboarding read', () => {
    setIntent('dive_site')
    const { result } = renderHook(() => useVenueSignupIntent())
    expect(result.current).toBe('dive_site')
    expect(readIntent()).toBe('dive_site')
  })

  it('stale "multi" intent (pre-rollback) resolves to null without clobbering storage', () => {
    setIntent('multi')
    const { result } = renderHook(() => useVenueSignupIntent())
    expect(result.current).toBe(null)
    expect(readIntent()).toBe('multi')
  })

  it('failed completion preserves intent (clear is not called)', () => {
    setIntent('pool')
    renderHook(() => useVenueSignupIntent())
    expect(readIntent()).toBe('pool')
  })

  it('successful completion clears intent exactly once', () => {
    setIntent('pool')
    renderHook(() => useVenueSignupIntent())
    expect(readIntent()).toBe('pool')

    clearStoredVenueSignupIntent()
    expect(readIntent()).toBe(null)

    clearStoredVenueSignupIntent()
    expect(readIntent()).toBe(null)
  })

  it('stale intent (Venue already complete) is removed by explicit clear', () => {
    setIntent('multi')
    clearStoredVenueSignupIntent()
    expect(readIntent()).toBe(null)
  })

  it('mixed-role precedence is unchanged regardless of stored intent', () => {
    setIntent('pool')
    expect(deriveDefaultRole(['Instructor', 'DiveCenter', 'Venue'])).toBe('DiveCenter')
    expect(deriveDefaultRole(['Venue', 'Agent', 'Compressor'])).toBe('Agent')
    expect(deriveDefaultRole(['Equipment', 'Venue', 'Instructor'])).toBe('Venue')
  })

  it('invalid stored value resolves to null without clobbering storage', () => {
    setIntent('garbage')
    const { result } = renderHook(() => useVenueSignupIntent())
    expect(result.current).toBe(null)
    expect(readIntent()).toBe('garbage')
  })
})

describe('walkthrough: venue signup intent stays display-only (no role-level Pool/Dive Site)', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('Pool tile collapses to a single Venue role for persistence', () => {
    const tiles = getSignupResourceTiles()
    const pool = tiles.find((t) => t.tileKey === 'pool') as SignupRoleTileConfig
    expect(collapseSignupTilesToRoles([pool])).toEqual(['Venue'])
  })

  it('Dive Site tile collapses to a single Venue role for persistence', () => {
    const tiles = getSignupResourceTiles()
    const diveSite = tiles.find((t) => t.tileKey === 'dive-site') as SignupRoleTileConfig
    expect(collapseSignupTilesToRoles([diveSite])).toEqual(['Venue'])
  })

  it('Pool + Dive Site collapse to a single Venue role', () => {
    const tiles = getSignupResourceTiles()
    const pool = tiles.find((t) => t.tileKey === 'pool') as SignupRoleTileConfig
    const diveSite = tiles.find((t) => t.tileKey === 'dive-site') as SignupRoleTileConfig
    expect(collapseSignupTilesToRoles([pool, diveSite])).toEqual(['Venue'])
  })

  it('intent value is "pool" — never Pool|DiveSite role names', () => {
    setIntent('pool')
    expect(readIntent()).toBe('pool')
    expect(readIntent()).not.toBe('Pool')
  })

  it('intent value is "dive_site" — never DiveSite role names', () => {
    setIntent('dive_site')
    expect(readIntent()).toBe('dive_site')
    expect(readIntent()).not.toBe('DiveSite')
  })
})
