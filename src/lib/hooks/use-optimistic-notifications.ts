'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { NotificationDoc } from '@/lib/types/notifications'

interface UseOptimisticNotificationsOptions {
  userId: string
  limit: number
}

interface UseOptimisticNotificationsReturn {
  notifications: NotificationDoc[] | undefined
  unreadCount: number
  handleMarkAsRead: (id: string) => Promise<void>
  handleDelete: (id: string) => Promise<void>
  handleClearAll: () => Promise<void>
}

/** Per-ID inflight tracking. Maps `${opType}:${id}` to a unique token. */
type InflightMap = Map<string, number>

let tokenCounter = 0

/**
 * Wraps notification queries and mutations with local-state optimistic updates.
 * Immediately reflects markAsRead, delete, and clearAll in the UI, reverting
 * if the server rejects.
 */
export function useOptimisticNotifications({
  userId,
  limit,
}: UseOptimisticNotificationsOptions): UseOptimisticNotificationsReturn {
  const rawNotifications = useQuery(api.notifications.listNotifications, { userId, limit })
  const serverNotifications = rawNotifications as NotificationDoc[] | undefined
  const markAsRead = useMutation(api.notifications.markAsRead)
  const deleteNotification = useMutation(api.notifications.deleteNotification)
  const clearAll = useMutation(api.notifications.clearAll)

  const [optimisticOverrides, setOptimisticOverrides] = useState<
    Map<string, Partial<NotificationDoc>>
  >(new Map())
  const [optimisticDeleted, setOptimisticDeleted] = useState<Set<string>>(new Set())
  const [optimisticClearedAll, setOptimisticClearedAll] = useState(false)

  // Inflight tracking: keyed by "opType:id", value is the token for the active call
  const inflightRef = useRef<InflightMap>(new Map())

  const notifications = useMemo(() => {
    if (serverNotifications === undefined) return undefined
    if (optimisticClearedAll) return []

    return serverNotifications
      .filter((n) => !optimisticDeleted.has(n._id))
      .map((n) => {
        const override = optimisticOverrides.get(n._id)
        return override ? { ...n, ...override } : n
      })
  }, [serverNotifications, optimisticOverrides, optimisticDeleted, optimisticClearedAll])

  const unreadCount = useMemo(() => {
    if (!notifications) return 0
    return notifications.filter((n) => n.readAt === undefined).length
  }, [notifications])

  const handleMarkAsRead = useCallback(async (id: string) => {
    const key = `read:${id}`
    // Guard: skip if a markAsRead is already in-flight for this ID
    if (inflightRef.current.has(key)) return

    const token = ++tokenCounter
    inflightRef.current.set(key, token)

    setOptimisticOverrides((prev) => {
      const next = new Map(prev)
      next.set(id, { readAt: Date.now() })
      return next
    })

    try {
      await markAsRead({ notificationId: id as Id<'notifications'> })
    } catch {
      // Swallow — optimistic state is reverted below
    } finally {
      // Only clean up if this token is still the active one for this key
      if (inflightRef.current.get(key) === token) {
        inflightRef.current.delete(key)
      }
      setOptimisticOverrides((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }
  }, [markAsRead])

  const handleDelete = useCallback(async (id: string) => {
    const key = `delete:${id}`
    // Guard: skip if a delete is already in-flight for this ID
    if (inflightRef.current.has(key)) return

    const token = ++tokenCounter
    inflightRef.current.set(key, token)

    setOptimisticDeleted((prev) => new Set(prev).add(id))

    try {
      await deleteNotification({ notificationId: id as Id<'notifications'> })
    } catch {
      // Swallow — optimistic state is reverted below
    } finally {
      // Only clean up if this token is still the active one for this key
      if (inflightRef.current.get(key) === token) {
        inflightRef.current.delete(key)
      }
      // Clear deleted flag
      setOptimisticDeleted((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      // Also clear any stale overrides for this ID (cross-operation cleanup)
      setOptimisticOverrides((prev) => {
        if (!prev.has(id)) return prev
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }
  }, [deleteNotification])

  const handleClearAll = useCallback(async () => {
    setOptimisticClearedAll(true)

    try {
      await clearAll({ userId })
    } catch {
      // Swallow — optimistic state is reverted below
    } finally {
      setOptimisticClearedAll(false)
    }
  }, [clearAll, userId])

  return {
    notifications,
    unreadCount,
    handleMarkAsRead,
    handleDelete,
    handleClearAll,
  }
}
