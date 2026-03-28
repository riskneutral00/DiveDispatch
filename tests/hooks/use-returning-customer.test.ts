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
})
