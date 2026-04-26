'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/lib/convex-generated'
import type { Id } from '@/lib/convex-generated'
import type { NotificationDoc } from '@/lib/types/notifications'

interface UseOptimisticNotificationsOptions {
  userId: string
  limit: number
  onError?: (operation: string) => void
}

interface UseOptimisticNotificationsReturn {
  notifications: NotificationDoc[] | undefined
  unreadCount: number
  handleMarkAsRead: (id: string) => Promise<void>
  handleDelete: (id: string) => Promise<void>
  handleClearAll: () => Promise<void>
}

type InflightMap = Map<string, number>

export function useOptimisticNotifications({
  userId,
  limit,
  onError,
}: UseOptimisticNotificationsOptions): UseOptimisticNotificationsReturn {
  const rawNotifications = useQuery(api.notifications.listNotifications, { userId, limit })
  const serverNotifications = rawNotifications as NotificationDoc[] | undefined
  const markAsRead = useMutation(api.notifications.markAsRead)
  const removeNotification = useMutation(api.notifications.removeNotification)
  const clearAll = useMutation(api.notifications.clearAll)

  const [optimisticOverrides, setOptimisticOverrides] = useState<
    Map<string, Partial<NotificationDoc>>
  >(new Map())
  const [optimisticDeleted, setOptimisticDeleted] = useState<Set<string>>(new Set())
  const [optimisticClearedAll, setOptimisticClearedAll] = useState(false)

  const inflightRef = useRef<InflightMap>(new Map())
  const tokenCounterRef = useRef(0)

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
    if (inflightRef.current.has(key)) return

    const token = ++tokenCounterRef.current
    inflightRef.current.set(key, token)

    setOptimisticOverrides((prev) => {
      const next = new Map(prev)
      next.set(id, { readAt: Date.now() })
      return next
    })

    try {
      await markAsRead({ notificationId: id as Id<'notifications'> })
    } catch {
      onError?.('markAsRead')
    } finally {
      if (inflightRef.current.get(key) === token) {
        inflightRef.current.delete(key)
      }
      setOptimisticOverrides((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }
  }, [markAsRead, onError])

  const handleDelete = useCallback(async (id: string) => {
    const key = `delete:${id}`
    if (inflightRef.current.has(key)) return

    const token = ++tokenCounterRef.current
    inflightRef.current.set(key, token)

    setOptimisticDeleted((prev) => new Set(prev).add(id))

    try {
      await removeNotification({ notificationId: id as Id<'notifications'> })
    } catch {
      onError?.('delete')
    } finally {
      if (inflightRef.current.get(key) === token) {
        inflightRef.current.delete(key)
      }
      setOptimisticDeleted((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setOptimisticOverrides((prev) => {
        if (!prev.has(id)) return prev
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }
  }, [removeNotification, onError])

  const handleClearAll = useCallback(async () => {
    const key = 'clearAll'
    if (inflightRef.current.has(key)) return

    const token = ++tokenCounterRef.current
    inflightRef.current.set(key, token)

    setOptimisticClearedAll(true)

    try {
      await clearAll({ userId })
    } catch {
      onError?.('clearAll')
    } finally {
      if (inflightRef.current.get(key) === token) {
        inflightRef.current.delete(key)
      }
      setOptimisticClearedAll(false)
    }
  }, [clearAll, userId, onError])

  return {
    notifications,
    unreadCount,
    handleMarkAsRead,
    handleDelete,
    handleClearAll,
  }
}
