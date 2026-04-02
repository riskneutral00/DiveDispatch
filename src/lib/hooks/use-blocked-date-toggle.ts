'use client'

import { useState, useCallback, useMemo } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import type { StakeholderRole } from '../utils/role'

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
 * Scoped to a specific (ownerSlug, roleType) pair so each stakeholder role
 * maintains its own independent set of blocked dates.
 */
export function useBlockedDateToggle({
  ownerSlug,
  roleType,
}: {
  ownerSlug: string
  roleType: StakeholderRole
}): UseBlockedDateToggleReturn {
  const blockedDatesData = useQuery(api.availability.getBlockedDatesForStakeholder, {
    ownerSlug,
    roleType,
  })
  const toggleBlockedDate = useMutation(api.availability.toggleBlockedDate)

  const [optimisticBlocked, setOptimisticBlocked] = useState<string[] | null>(null)
  const [isToggling, setIsToggling] = useState(false)
  const [pendingToggle, setPendingToggle] = useState<{
    date: string
    mode: 'block' | 'unblock'
  } | null>(null)

  const serverBlocked: string[] = useMemo(() => blockedDatesData ?? [], [blockedDatesData])
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

    const current = serverBlocked
    const optimistic: string[] =
      mode === 'block' ? [...current, date] : current.filter((d: string) => d !== date)
    setOptimisticBlocked(optimistic)
    setPendingToggle(null)
    setIsToggling(true)

    try {
      await toggleBlockedDate({ date, roleType })
    } finally {
      setIsToggling(false)
      setOptimisticBlocked(null)
    }
  }, [pendingToggle, serverBlocked, toggleBlockedDate, roleType])

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
