'use client'

import { useEffect, useRef, useState } from 'react'

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
  returningCustomer: Pick<ReturningCustomerMatch, '_id' | 'legalFirstName' | 'legalLastName' | 'email'> | null
  returningConfirmed: boolean
  returningDismissed: boolean
  confirm: () => void
  dismiss: () => void
  showBanner: boolean
}

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
