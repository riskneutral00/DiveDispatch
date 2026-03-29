'use client'

import { useEffect, useRef, useState } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ReturningCustomerMatch {
  _id: string
  legalFirstName: string
  legalLastName: string
  email: string
  preferredName?: string
  phone: string
  dateOfBirth: string
  gender: 'M' | 'F' | 'Other'
  nationality: string
  passportNumber: string
  passportIssuingCountry: string
  passportExpirationDate: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelation: string
  agency?: string
  agencyID?: string
  allergies?: string
}

export interface UseReturningCustomerReturn {
  /** The matched returning customer, if any (and not yet confirmed/dismissed). */
  returningCustomer: Pick<ReturningCustomerMatch, '_id' | 'legalFirstName' | 'legalLastName' | 'email'> | null
  /** True when the user confirmed "that's me". */
  returningConfirmed: boolean
  /** True when the user dismissed "not me". */
  returningDismissed: boolean
  /** Call to confirm the match and get pre-fill data. */
  confirm: () => void
  /** Call to dismiss the match. */
  dismiss: () => void
  /** Whether the banner should be visible. */
  showBanner: boolean
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Manages returning-customer dedup detection state.
 *
 * @param queryResult - The result from `api.customers.checkReturningCustomer`,
 *   or `undefined`/`null` when the query hasn't returned or was skipped.
 * @param onConfirm - Called when the user confirms the match. Receives the full
 *   customer data for form pre-fill.
 */
export function useReturningCustomer(
  queryResult: ReturningCustomerMatch | undefined | null,
  onConfirm?: (data: ReturningCustomerMatch) => void,
): UseReturningCustomerReturn {
  const [returningCustomer, setReturningCustomer] = useState<Pick<
    ReturningCustomerMatch,
    '_id' | 'legalFirstName' | 'legalLastName' | 'email'
  > | null>(null)
  const [returningConfirmed, setReturningConfirmed] = useState(false)
  const [returningDismissed, setReturningDismissed] = useState(false)

  // Track previous email to reset dismissed/confirmed when the email changes.
  // undefined (loading/refetching) is ignored to avoid false resets.
  const prevEmailRef = useRef<string | null | undefined>(queryResult?.email)
  const currentEmail = queryResult === undefined ? undefined : (queryResult?.email ?? null)

  useEffect(() => {
    if (currentEmail === undefined) return // skip undefined (loading state)
    if (prevEmailRef.current !== undefined && currentEmail !== prevEmailRef.current) {
      setReturningConfirmed(false)
      setReturningDismissed(false)
      setReturningCustomer(null)
    }
    prevEmailRef.current = currentEmail
  }, [currentEmail])

  useEffect(() => {
    if (queryResult && !returningConfirmed && !returningDismissed) {
      setReturningCustomer({
        _id: queryResult._id,
        legalFirstName: queryResult.legalFirstName,
        legalLastName: queryResult.legalLastName,
        email: queryResult.email,
      })
    }
  }, [queryResult, returningConfirmed, returningDismissed])

  function confirm() {
    if (!queryResult) return
    setReturningConfirmed(true)
    setReturningCustomer(null)
    onConfirm?.(queryResult)
  }

  function dismiss() {
    setReturningDismissed(true)
    setReturningCustomer(null)
  }

  const showBanner = returningCustomer !== null && !returningConfirmed && !returningDismissed

  return {
    returningCustomer,
    returningConfirmed,
    returningDismissed,
    confirm,
    dismiss,
    showBanner,
  }
}
