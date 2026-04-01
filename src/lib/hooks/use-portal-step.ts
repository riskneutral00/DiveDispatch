'use client'

import { useState, useCallback } from 'react'
import { mapPortalMutationError } from '@/lib/utils/convex-error'

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
   * Standardized mutation error handler (see mapPortalMutationError).
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
    setServerError(mapPortalMutationError(err))
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
