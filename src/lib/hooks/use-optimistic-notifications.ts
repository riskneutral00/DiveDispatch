'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { NotificationDoc } from '@/components/dashboard/notification-item'

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
    setOptimisticOverrides((prev) => {
      const next = new Map(prev)
      next.set(id, { readAt: Date.now() })
      return next
    })

    try {
      await markAsRead({ notificationId: id as Id<'notifications'> })
      // Clear after success so server data takes over
      setOptimisticOverrides((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    } catch {
      // Revert optimistic update
      setOptimisticOverrides((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }
  }, [markAsRead])

  const handleDelete = useCallback(async (id: string) => {
    setOptimisticDeleted((prev) => new Set(prev).add(id))

    try {
      await deleteNotification({ notificationId: id as Id<'notifications'> })
      // Clear after success so server data takes over
      setOptimisticDeleted((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch {
      // Revert optimistic delete
      setOptimisticDeleted((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [deleteNotification])

  const handleClearAll = useCallback(async () => {
    setOptimisticClearedAll(true)

    try {
      await clearAll({ userId })
      // Clear after success so server data takes over
      setOptimisticClearedAll(false)
    } catch {
      // Revert optimistic clear
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
