'use client'

import { useState, useCallback } from 'react'
import { parseConvexError } from '@/lib/utils/convex-error'

/**
 * Shared state + try/catch/finally pattern for multi-step form steps.
 *
 * Encapsulates saving/error/initialized state that every dashboard
 * and portal step duplicates.
 */
export interface UseFormStepReturn {
  saving: boolean
  error: string | null
  initialized: boolean
  setInitialized: () => void
  setError: (msg: string | null) => void
  /** Wraps an async action with saving/error/finally lifecycle. */
  runSave: (action: () => Promise<void>) => Promise<void>
}

export function useFormStep(): UseFormStepReturn {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitializedRaw] = useState(false)

  const setInitialized = useCallback(() => setInitializedRaw(true), [])

  const runSave = useCallback(async (action: () => Promise<void>) => {
    setSaving(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(parseConvexError(err, 'Save failed'))
    } finally {
      setSaving(false)
    }
  }, [])

  return { saving, error, initialized, setInitialized, setError, runSave }
}
