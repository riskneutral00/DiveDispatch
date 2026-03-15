'use client'

// ── useFormValidation ─────────────────────────────────────────────────────────
// Minimal Zod-backed form validation hook. No form library dependency.
// Wraps Zod .safeParse() and maps ZodError.issues → { [path]: message }.

import { useState, useCallback } from 'react'
import { z } from 'zod'

export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors?: Record<string, string>
}

export interface UseFormValidationReturn<T> {
  /** Run full-schema validation. Updates errors state. Returns structured result. */
  validate: (data: unknown) => ValidationResult<T>
  /** Current field errors keyed by dot-separated path (e.g. "emergencyContactName"). */
  errors: Record<string, string>
  /** Clear a single field's error (e.g. on field change). */
  clearError: (field: string) => void
  /** Reset all errors. */
  clearAllErrors: () => void
}

export function useFormValidation<T>(
  schema: z.ZodSchema<T>,
): UseFormValidationReturn<T> {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback(
    (data: unknown): ValidationResult<T> => {
      const result = schema.safeParse(data)
      if (result.success) {
        setErrors({})
        return { success: true, data: result.data }
      }
      const errs: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const path = issue.path.join('.')
        if (!errs[path]) errs[path] = issue.message
      })
      setErrors(errs)
      return { success: false, errors: errs }
    },
    [schema],
  )

  const clearError = useCallback((field: string) => {
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const clearAllErrors = useCallback(() => setErrors({}), [])

  return { validate, errors, clearError, clearAllErrors }
}
