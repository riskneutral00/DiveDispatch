'use client'

import { useState, useCallback } from 'react'
import { z } from 'zod'
import { zodIssuesToFieldErrors } from '@/lib/validation/zod-helpers'

export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors?: Record<string, string>
}

export interface UseFormValidationReturn<T> {
  validate: (data: unknown) => ValidationResult<T>
  errors: Record<string, string>
  clearError: (field: string) => void
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
      const errs = zodIssuesToFieldErrors(result.error.issues)
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
