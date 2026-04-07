'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { parseConvexError } from '@/lib/utils/convex-error'

interface UseMutationWithFeedbackOptions {
  successMessage?: string
  errorFallback?: string
  onError?: (err: unknown) => string
}

type MutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; raw: unknown }

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
