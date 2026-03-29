// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useReturningCustomer,
  type ReturningCustomerMatch,
} from '../../src/lib/hooks/use-returning-customer'

const MATCH: ReturningCustomerMatch = {
  _id: 'cust_123',
  legalFirstName: 'Jane',
  legalLastName: 'Doe',
  email: 'jane@example.com',
  phone: '+1234567890',
  dateOfBirth: '1990-06-15',
  gender: 'F' as const,
  nationality: 'United States',
  passportNumber: 'AB1234567',
  passportIssuingCountry: 'United States',
  passportExpirationDate: '2030-01-01',
  emergencyContactName: 'John Doe',
  emergencyContactPhone: '+1234567891',
  emergencyContactRelation: 'Spouse',
  agency: 'PADI',
  agencyID: '99887766',
}

describe('useReturningCustomer', () => {
  it('starts with no match and banner hidden', () => {
    const { result } = renderHook(() => useReturningCustomer(null))
    expect(result.current.returningCustomer).toBeNull()
    expect(result.current.returningConfirmed).toBe(false)
    expect(result.current.returningDismissed).toBe(false)
    expect(result.current.showBanner).toBe(false)
  })

  it('shows banner when query returns a match', () => {
    const { result } = renderHook(() => useReturningCustomer(MATCH))
    expect(result.current.showBanner).toBe(true)
    expect(result.current.returningCustomer).toEqual({
      _id: 'cust_123',
      legalFirstName: 'Jane',
      legalLastName: 'Doe',
      email: 'jane@example.com',
    })
  })

  it('confirm sets returningConfirmed and hides banner', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useReturningCustomer(MATCH, onConfirm))

    act(() => {
      result.current.confirm()
    })

    expect(result.current.returningConfirmed).toBe(true)
    expect(result.current.showBanner).toBe(false)
    expect(result.current.returningCustomer).toBeNull()
    expect(onConfirm).toHaveBeenCalledWith(MATCH)
  })

  it('dismiss sets returningDismissed and hides banner', () => {
    const { result } = renderHook(() => useReturningCustomer(MATCH))

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.returningDismissed).toBe(true)
    expect(result.current.showBanner).toBe(false)
    expect(result.current.returningCustomer).toBeNull()
  })

  it('does not show banner after dismiss even if query updates', () => {
    const { result, rerender } = renderHook(
      ({ qr }) => useReturningCustomer(qr),
      { initialProps: { qr: MATCH as ReturningCustomerMatch | null } },
    )

    act(() => {
      result.current.dismiss()
    })

    // Re-render with the same query result
    rerender({ qr: MATCH })

    expect(result.current.showBanner).toBe(false)
    expect(result.current.returningDismissed).toBe(true)
  })

  it('confirm does nothing when queryResult is null', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useReturningCustomer(null, onConfirm))

    act(() => {
      result.current.confirm()
    })

    expect(onConfirm).not.toHaveBeenCalled()
    expect(result.current.returningConfirmed).toBe(false)
  })

  describe('resets dismissed/confirmed state on email change', () => {
    const MATCH_B: ReturningCustomerMatch = {
      ...MATCH,
      _id: 'cust_456',
      legalFirstName: 'Bob',
      legalLastName: 'Smith',
      email: 'bob@example.com',
    }

    it('dismiss for email A -> change to email B (match) -> banner appears', () => {
      const { result, rerender } = renderHook(
        ({ qr }) => useReturningCustomer(qr),
        { initialProps: { qr: MATCH as ReturningCustomerMatch | null } },
      )

      // Dismiss the match for email A
      act(() => {
        result.current.dismiss()
      })
      expect(result.current.showBanner).toBe(false)
      expect(result.current.returningDismissed).toBe(true)

      // Change to email B (different match)
      rerender({ qr: MATCH_B })

      expect(result.current.returningDismissed).toBe(false)
      expect(result.current.returningConfirmed).toBe(false)
      expect(result.current.showBanner).toBe(true)
      expect(result.current.returningCustomer).toEqual({
        _id: 'cust_456',
        legalFirstName: 'Bob',
        legalLastName: 'Smith',
        email: 'bob@example.com',
      })
    })

    it('dismiss for email A -> change to email B (no match) -> banner hidden', () => {
      const { result, rerender } = renderHook(
        ({ qr }) => useReturningCustomer(qr),
        { initialProps: { qr: MATCH as ReturningCustomerMatch | null } },
      )

      // Dismiss the match for email A
      act(() => {
        result.current.dismiss()
      })
      expect(result.current.returningDismissed).toBe(true)

      // Change to email B (no match -- null)
      rerender({ qr: null })

      expect(result.current.returningDismissed).toBe(false)
      expect(result.current.returningConfirmed).toBe(false)
      expect(result.current.showBanner).toBe(false)
      expect(result.current.returningCustomer).toBeNull()
    })

    it('confirm for email A -> change to email B (match) -> banner appears', () => {
      const onConfirm = vi.fn()
      const { result, rerender } = renderHook(
        ({ qr }) => useReturningCustomer(qr, onConfirm),
        { initialProps: { qr: MATCH as ReturningCustomerMatch | null } },
      )

      // Confirm the match for email A
      act(() => {
        result.current.confirm()
      })
      expect(result.current.returningConfirmed).toBe(true)
      expect(result.current.showBanner).toBe(false)

      // Change to email B (different match)
      rerender({ qr: MATCH_B })

      expect(result.current.returningConfirmed).toBe(false)
      expect(result.current.returningDismissed).toBe(false)
      expect(result.current.showBanner).toBe(true)
      expect(result.current.returningCustomer).toEqual({
        _id: 'cust_456',
        legalFirstName: 'Bob',
        legalLastName: 'Smith',
        email: 'bob@example.com',
      })
    })

    it('does not reset when same email re-renders (dismissed stays dismissed)', () => {
      const { result, rerender } = renderHook(
        ({ qr }) => useReturningCustomer(qr),
        { initialProps: { qr: MATCH as ReturningCustomerMatch | null } },
      )

      act(() => {
        result.current.dismiss()
      })
      expect(result.current.returningDismissed).toBe(true)

      // Re-render with same email (same match object, possibly new reference)
      rerender({ qr: { ...MATCH } })

      expect(result.current.returningDismissed).toBe(true)
      expect(result.current.showBanner).toBe(false)
    })

    it('does not reset when queryResult goes from match to undefined (loading state)', () => {
      const { result, rerender } = renderHook(
        ({ qr }) => useReturningCustomer(qr),
        { initialProps: { qr: MATCH as ReturningCustomerMatch | undefined } },
      )

      act(() => {
        result.current.dismiss()
      })
      expect(result.current.returningDismissed).toBe(true)

      // Convex query returns undefined briefly while re-fetching
      rerender({ qr: undefined })

      // Should preserve dismissed state -- undefined is not a new email
      expect(result.current.returningDismissed).toBe(true)
    })
  })
})
