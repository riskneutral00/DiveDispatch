'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useConvexAuth } from 'convex/react'
import type { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server'

const TIMEOUT_MS = 8000

/**
 * Wrapper around Convex useQuery that distinguishes "still loading" from
 * "something went wrong" (server error, missing user row, etc.).
 *
 * Convex useQuery returns undefined both while loading AND on server errors,
 * so we use a timeout: if authenticated + undefined persists > 8s → isError.
 */
export function useStableQuery<Q extends FunctionReference<'query'>>(
  query: Q,
  args: FunctionArgs<Q> | 'skip',
): {
  data: FunctionReturnType<Q> | undefined
  isLoading: boolean
  isError: boolean
} {
  const result = useQuery(query, args)
  const { isAuthenticated } = useConvexAuth()
  const [isError, setIsError] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (result !== undefined || args === 'skip') {
      // Data arrived or query skipped — clear any pending timer
      setIsError(false)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    if (isAuthenticated && !timerRef.current) {
      timerRef.current = setTimeout(() => {
        setIsError(true)
        timerRef.current = null
      }, TIMEOUT_MS)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [result, isAuthenticated, args])

  const isLoading = result === undefined && !isError && args !== 'skip'

  return { data: result, isLoading, isError }
}
