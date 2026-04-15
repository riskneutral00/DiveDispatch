'use client'

import { useState } from 'react'

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
  languages?: string[]
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
  const [returningConfirmed, setReturningConfirmed] = useState(false)
  const [returningDismissed, setReturningDismissed] = useState(false)

  const currentEmail = queryResult === undefined ? undefined : (queryResult?.email ?? null)
  const [prevEmail, setPrevEmail] = useState(currentEmail)

  if (currentEmail !== undefined && currentEmail !== prevEmail) {
    setPrevEmail(currentEmail)
    setReturningConfirmed(false)
    setReturningDismissed(false)
  }

  const returningCustomer = (queryResult && !returningConfirmed && !returningDismissed)
    ? {
        _id: queryResult._id,
        legalFirstName: queryResult.legalFirstName,
        legalLastName: queryResult.legalLastName,
        email: queryResult.email,
      }
    : null

  function confirm() {
    if (!queryResult) return
    setReturningConfirmed(true)
    onConfirm?.(queryResult)
  }

  function dismiss() {
    setReturningDismissed(true)
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
