// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  VENUE_SIGNUP_INTENT_STORAGE_KEY,
} from '@/lib/constants/signup-role-tiles'
import {
  useVenueSignupIntent,
  clearStoredVenueSignupIntent,
} from '../use-venue-signup-intent'

describe('useVenueSignupIntent', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('returns null when no intent stored', () => {
    const { result } = renderHook(() => useVenueSignupIntent())
    expect(result.current).toBe(null)
  })

  it('returns "pool" when stored', () => {
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'pool')
    const { result } = renderHook(() => useVenueSignupIntent())
    expect(result.current).toBe('pool')
  })

  it('returns "dive_site" when stored', () => {
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'dive_site')
    const { result } = renderHook(() => useVenueSignupIntent())
    expect(result.current).toBe('dive_site')
  })

  it('returns null for stale "multi" without clobbering storage', () => {
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'multi')
    const { result } = renderHook(() => useVenueSignupIntent())
    expect(result.current).toBe(null)
    expect(window.sessionStorage.getItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)).toBe('multi')
  })

  it('does NOT clear storage on read', () => {
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'pool')
    renderHook(() => useVenueSignupIntent())
    expect(window.sessionStorage.getItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)).toBe('pool')
  })

  it('returns null for invalid values without touching storage', () => {
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'garbage')
    const { result } = renderHook(() => useVenueSignupIntent())
    expect(result.current).toBe(null)
    expect(window.sessionStorage.getItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)).toBe('garbage')
  })

  it('does not re-read after consumption (stable across re-renders)', () => {
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'pool')
    const { result, rerender } = renderHook(() => useVenueSignupIntent())
    expect(result.current).toBe('pool')
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'dive_site')
    rerender()
    expect(result.current).toBe('pool')
  })
})

describe('clearStoredVenueSignupIntent', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('removes the stored intent', () => {
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'pool')
    clearStoredVenueSignupIntent()
    expect(window.sessionStorage.getItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)).toBe(null)
  })

  it('is a no-op when nothing stored', () => {
    clearStoredVenueSignupIntent()
    expect(window.sessionStorage.getItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)).toBe(null)
  })
})
