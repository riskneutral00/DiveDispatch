'use client'

import { useState, useCallback } from 'react'
import { mapPortalMutationError, parseConvexErrorI18n } from '@/lib/utils/convex-error'

type TranslateFn = (key: string, values?: Record<string, string>) => string

export interface ValidationRule<T = string> {
  test: (value: T) => boolean
  message: string
  value: T
}

export interface UsePortalStepReturn {
  errors: Record<string, string>
  setFieldError: (field: string, message: string) => void
  setErrors: (errors: Record<string, string>) => void
  clearError: (field: string) => void
  clearAllErrors: () => void

  serverError: string | null
  clearServerError: () => void
  handleMutationError: (err: unknown) => void

  submitting: boolean
  setSubmitting: (v: boolean) => void

  validateFields: (rules: Record<string, ValidationRule>) => boolean
}

export function usePortalStep(t?: TranslateFn): UsePortalStepReturn {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

  const clearServerError = useCallback(() => setServerError(null), [])

  const handleMutationError = useCallback((err: unknown) => {
    if (t) {
      setServerError(parseConvexErrorI18n(err, t))
    } else {
      setServerError(mapPortalMutationError(err))
    }
  }, [t])

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
