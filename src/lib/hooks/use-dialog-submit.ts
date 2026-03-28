'use client'

import { useState, useCallback, useRef } from 'react'
import { parseConvexError } from '@/lib/utils/convex-error'

/**
 * Shared state + try/catch/finally pattern for dialog submissions.
 *
 * Encapsulates submitting/error state and the safe-close guard that
 * every dialog with an async action duplicates.
 */
export interface UseDialogSubmitReturn {
  submitting: boolean
  error: string | null
  setError: (msg: string | null) => void
  /** Wraps an async action with submitting/error/finally lifecycle. */
  runSubmit: (action: () => Promise<void>) => Promise<void>
  /** Returns onClose wrapper that prevents close during submission and clears error. */
  safeClose: (onClose: () => void) => () => void
}

export function useDialogSubmit(): UseDialogSubmitReturn {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(false)

  const runSubmit = useCallback(async (action: () => Promise<void>) => {
    setError(null)
    setSubmitting(true)
    submittingRef.current = true
    try {
      await action()
    } catch (err) {
      setError(parseConvexError(err, 'An unexpected error occurred.'))
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }, [])

  const safeClose = useCallback(
    (onClose: () => void) => () => {
      if (submittingRef.current) return
      setError(null)
      onClose()
    },
    [],
  )

  return { submitting, error, setError, runSubmit, safeClose }
}
