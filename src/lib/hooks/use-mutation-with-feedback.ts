'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { parseConvexError } from '@/lib/utils/convex-error'

interface UseMutationWithFeedbackOptions {
  /** Toast message on success (omit to skip toast) */
  successMessage?: string
  /** Fallback error message when ConvexError has no structured data */
  errorFallback?: string
  /** Custom error mapper — receives raw error, returns user-facing string.
   *  When provided, replaces the default parseConvexError call. */
  onError?: (err: unknown) => string
}

type MutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; raw: unknown }

/**
 * Wraps an async mutation function with loading/error state management and toast feedback.
 * Does NOT wrap useMutation — takes any async function as input for composability.
 */
export function useMutationWithFeedback<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
  opts?: UseMutationWithFeedbackOptions,
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(
    async (...args: TArgs): Promise<MutationResult<TResult>> => {
      setError(null)
      setLoading(true)
      try {
        const result = await mutationFn(...args)
        if (opts?.successMessage) {
          toast.success(opts.successMessage, { duration: 3000 })
        }
        return { ok: true, value: result }
      } catch (e: unknown) {
        const message = opts?.onError
          ? opts.onError(e)
          : parseConvexError(e, opts?.errorFallback ?? 'Something went wrong')
        setError(message)
        toast.error(message, { duration: 5000 })
        return { ok: false, error: message, raw: e }
      } finally {
        setLoading(false)
      }
    },
    [mutationFn, opts?.successMessage, opts?.errorFallback, opts?.onError],
  )

  const clearError = useCallback(() => setError(null), [])

  return { execute, loading, error, clearError }
}
