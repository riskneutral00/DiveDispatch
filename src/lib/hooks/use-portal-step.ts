'use client'

import { useState, useCallback } from 'react'
import { getConvexErrorCode, parseConvexError } from '@/lib/utils/convex-error'
import {
  TOKEN_EXPIRED_MESSAGE,
  BOOKING_CLOSED_MESSAGE,
  UNEXPECTED_ERROR_MESSAGE,
} from '@/lib/constants/error-messages'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ValidationRule<T = string> {
  /** Predicate — return true when the value is valid. */
  test: (value: T) => boolean
  /** Error message shown when test returns false. */
  message: string
  /** The current field value to validate. */
  value: T
}

export interface UsePortalStepReturn {
  // ── Field-level errors ────────────────────────────────────────────────
  errors: Record<string, string>
  setFieldError: (field: string, message: string) => void
  /** Bulk-replace all field errors (useful in validate() functions). */
  setErrors: (errors: Record<string, string>) => void
  clearError: (field: string) => void
  clearAllErrors: () => void

  // ── Server / mutation errors ──────────────────────────────────────────
  serverError: string | null
  clearServerError: () => void
  /**
   * Standardized mutation error handler.
   * Maps TOKEN_EXPIRED and BOOKING_CLOSED ConvexError codes to their
   * canonical messages. Generic ConvexErrors with a `reason` field use
   * that reason; everything else falls back to UNEXPECTED_ERROR_MESSAGE.
   */
  handleMutationError: (err: unknown) => void

  // ── Submission lifecycle ──────────────────────────────────────────────
  submitting: boolean
  setSubmitting: (v: boolean) => void

  // ── Declarative validation ────────────────────────────────────────────
  /**
   * Run a set of validation rules. Clears previous errors, then sets
   * errors for every failing rule. Returns true when all rules pass.
   */
  validateFields: (rules: Record<string, ValidationRule>) => boolean
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function usePortalStep(): UsePortalStepReturn {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Field errors ────────────────────────────────────────────────────

  const setFieldError = useCallback((field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }))
  }, [])

  const clearError = useCallback((field: string) => {
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const bulkSetErrors = useCallback(
    (next: Record<string, string>) => setErrors(next),
    [],
  )

  const clearAllErrors = useCallback(() => setErrors({}), [])

  // ── Server error ──────────────────────────────────────────────────

  const clearServerError = useCallback(() => setServerError(null), [])

  const handleMutationError = useCallback((err: unknown) => {
    const code = getConvexErrorCode(err)
    if (code === 'TOKEN_EXPIRED') {
      setServerError(TOKEN_EXPIRED_MESSAGE)
    } else if (code === 'BOOKING_CLOSED') {
      setServerError(BOOKING_CLOSED_MESSAGE)
    } else {
      setServerError(parseConvexError(err, UNEXPECTED_ERROR_MESSAGE))
    }
  }, [])

  // ── Declarative validation ────────────────────────────────────────

  const validateFields = useCallback(
    (rules: Record<string, ValidationRule>): boolean => {
      const next: Record<string, string> = {}
      for (const [field, rule] of Object.entries(rules)) {
        if (!rule.test(rule.value)) {
          next[field] = rule.message
        }
      }
      setErrors(next)
      return Object.keys(next).length === 0
    },
    [],
  )

  return {
    errors,
    setFieldError,
    setErrors: bulkSetErrors,
    clearError,
    clearAllErrors,
    serverError,
    clearServerError,
    handleMutationError,
    submitting,
    setSubmitting,
    validateFields,
  }
}
