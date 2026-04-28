'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useConvexAuth } from 'convex/react'
import type { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server'

export const STABLE_QUERY_DEFAULT_TIMEOUT_MS = 8000

interface UseStableQueryOptions {
  timeoutMs?: number
}

export function useStableQuery<Q extends FunctionReference<'query'>>(
  query: Q,
  args: FunctionArgs<Q> | 'skip',
  options?: UseStableQueryOptions,
): {
  data: FunctionReturnType<Q> | undefined
  isLoading: boolean
  isError: boolean
} {
  const result = useQuery(query, args)
  const { isAuthenticated } = useConvexAuth()
  const [isError, setIsError] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timeoutMs = options?.timeoutMs ?? STABLE_QUERY_DEFAULT_TIMEOUT_MS

  if ((result !== undefined || args === 'skip') && isError) {
    setIsError(false)
  }

  useEffect(() => {
    if (result !== undefined || args === 'skip') {
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
      }, timeoutMs)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [result, isAuthenticated, args, timeoutMs])

  const isLoading = result === undefined && !isError && args !== 'skip'

  return { data: result, isLoading, isError }
}
