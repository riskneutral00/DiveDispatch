'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { NotificationItem } from './notification-item'
import { useOptimisticNotifications } from '@/lib/hooks/use-optimistic-notifications'

const OP_LABELS: Record<string, string> = {
  markAsRead: 'mark as read',
  delete: 'delete',
  clearAll: 'clear all',
}

interface NotificationPanelProps {
  userId: string
}

export function NotificationPanel({ userId }: NotificationPanelProps) {
  const [liveMessage, setLiveMessage] = useState('')
  const t = useTranslations('common')

  const onError = useCallback((operation: string) => {
    toast.error(t('actionFailed', { action: OP_LABELS[operation] ?? operation }))
  }, [t])

  const {
    notifications,
    handleMarkAsRead,
    handleDelete,
    handleClearAll,
  } = useOptimisticNotifications({ userId, limit: 20, onError })

  const announce = useCallback((message: string) => {
    setLiveMessage(message)
  }, [])

  async function handleItemClick(id: string) {
    announce('Marking notification as read...')
    await handleMarkAsRead(id)
  }

  async function handleItemDelete(id: string) {
    await handleDelete(id)
    announce('Notification deleted')
  }

  async function handleClearAllClick() {
    const count = notifications?.length ?? 0
    await handleClearAll()
    announce(`All ${count} notifications cleared`)
  }

  const hasNotifications = (notifications?.length ?? 0) > 0

  return (
    <div
      className="w-80 max-w-[calc(100%-2rem)] max-h-[28rem] flex flex-col overflow-hidden"
      role="group"
      aria-label="Notifications"
    >
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-glass-border"
      >
        <span className="text-body font-semibold text-primary">
          {t('notifications')}
        </span>
        {hasNotifications && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAllClick}
          >
            {t('clear')}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {notifications === undefined && (
          <div className="flex items-center justify-center py-6 text-primary">
            <Spinner />
          </div>
        )}
        {notifications?.length === 0 && (
          <EmptyState message={t('noNotifications')} className="py-6" />
        )}
        {notifications?.map((n) => (
          <NotificationItem
            key={n._id}
            notification={n}
            onClick={handleItemClick}
            onDelete={handleItemDelete}
          />
        ))}
      </div>

      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {liveMessage}
      </div>
    </div>
  )
}
