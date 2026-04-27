'use client'

import { useState, useCallback, useRef } from 'react'
import { z } from 'zod'
import {
  RESERVED_ERROR_KEYS,
  zodIssuesForFieldOrChild,
  zodIssuesToFieldErrors,
} from '@/lib/validation/zod-helpers'

export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors?: Record<string, string>
}

export interface UseFormValidationReturn<T> {
  validate: (data: unknown) => ValidationResult<T>
  validateField: (field: string, data: unknown) => void
  markTouched: (field: string) => void
  errors: Record<string, string>
  clearError: (field: string) => void
  clearAllErrors: () => void
}

export function useFormValidation<T>(
  schema: z.ZodSchema<T>,
): UseFormValidationReturn<T> {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const touchedRef = useRef<Set<string>>(new Set())

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

  const markTouched = useCallback((field: string) => {
    touchedRef.current.add(field)
  }, [])

  const validateField = useCallback(
    (field: string, data: unknown) => {
      touchedRef.current.add(field)
      const result = schema.safeParse(data)
      if (result.success) {
        setErrors((prev) => {
          let changed = false
          const next: Record<string, string> = {}
          for (const k of Object.keys(prev)) {
            if (RESERVED_ERROR_KEYS.has(k)) {
              next[k] = prev[k]!
            } else {
              changed = true
            }
          }
          return changed ? next : prev
        })
        return
      }
      const issues = result.error.issues
      setErrors((prev) => {
        const next: Record<string, string> = {}
        for (const k of Object.keys(prev)) {
          if (RESERVED_ERROR_KEYS.has(k)) {
            next[k] = prev[k]!
            continue
          }
          if (k === field || !touchedRef.current.has(k)) continue
          const refreshed = zodIssuesForFieldOrChild(issues, k)
          if (refreshed) next[k] = refreshed
        }
        const blurred = zodIssuesForFieldOrChild(issues, field)
        if (blurred) next[field] = blurred
        return next
      })
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

  const clearAllErrors = useCallback(() => {
    setErrors({})
    touchedRef.current = new Set()
  }, [])

  return { validate, validateField, markTouched, errors, clearError, clearAllErrors }
}
