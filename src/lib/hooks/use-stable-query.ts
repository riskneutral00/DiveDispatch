'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useConvexAuth } from 'convex/react'
import type { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server'

const TIMEOUT_MS = 8000

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
