'use client'

import { useState, useCallback, useMemo } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

interface UseBlockedDateToggleReturn {
  blockedDates: string[]
  isToggling: boolean
  pendingToggle: { date: string; mode: 'block' | 'unblock' } | null
  requestToggle: (date: string) => void
  confirmToggle: () => Promise<void>
  cancelToggle: () => void
}

/**
 * Hook for resource users to block/unblock dates with optimistic updates.
 * Uses api.availability.toggleBlockedDate mutation.
 */
export function useBlockedDateToggle(): UseBlockedDateToggleReturn {
  const currentUser = useQuery(api.users.me)
  const toggleBlockedDate = useMutation(api.availability.toggleBlockedDate)

  const [optimisticBlocked, setOptimisticBlocked] = useState<string[] | null>(null)
  const [isToggling, setIsToggling] = useState(false)
  const [pendingToggle, setPendingToggle] = useState<{
    date: string
    mode: 'block' | 'unblock'
  } | null>(null)

  // Use optimistic state if available, otherwise fall back to server state
  const serverBlocked: string[] = useMemo(
    () => (currentUser?.blockedDates as string[] | undefined) ?? [],
    [currentUser],
  )
  const blockedDates = optimisticBlocked ?? serverBlocked

  const requestToggle = useCallback(
    (date: string) => {
      const isBlocked = blockedDates.includes(date)
      setPendingToggle({ date, mode: isBlocked ? 'unblock' : 'block' })
    },
    [blockedDates],
  )

  const confirmToggle = useCallback(async () => {
    if (!pendingToggle) return
    const { date, mode } = pendingToggle

    // Optimistic update
    const current = serverBlocked
    const optimistic: string[] =
      mode === 'block' ? [...current, date] : current.filter((d: string) => d !== date)
    setOptimisticBlocked(optimistic)
    setPendingToggle(null)
    setIsToggling(true)

    try {
      await toggleBlockedDate({ date })
    } finally {
      setIsToggling(false)
      setOptimisticBlocked(null)
    }
  }, [pendingToggle, serverBlocked, toggleBlockedDate])

  const cancelToggle = useCallback(() => {
    setPendingToggle(null)
  }, [])

  return {
    blockedDates,
    isToggling,
    pendingToggle,
    requestToggle,
    confirmToggle,
    cancelToggle,
  }
}
