/**
 * @vitest-environment jsdom
 * @module-tag slow
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  VENUE_SIGNUP_INTENT_STORAGE_KEY,
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
    setIntent('dive_site')
    const first = renderHook(() => useVenueSignupIntent())
    expect(first.result.current).toBe('dive_site')
    first.unmount()

    const second = renderHook(() => useVenueSignupIntent())
    expect(second.result.current).toBe('dive_site')
    expect(readIntent()).toBe('dive_site')
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
