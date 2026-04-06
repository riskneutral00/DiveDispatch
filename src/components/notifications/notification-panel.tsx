'use client'

import { useRef, useState, useCallback } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { NotificationItem } from './notification-item'
import { useOptimisticNotifications } from '@/lib/hooks/use-optimistic-notifications'
import { useFocusTrap } from '@/lib/hooks/use-focus-trap'

interface NotificationPanelProps {
  userId: string
  onClose: () => void
}

export function NotificationPanel({ userId, onClose }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [liveMessage, setLiveMessage] = useState('')
  const {
    notifications,
    handleMarkAsRead,
    handleDelete,
    handleClearAll,
  } = useOptimisticNotifications({ userId, limit: 20 })

  useFocusTrap(panelRef, { onClose })

  const announce = useCallback((message: string) => {
    setLiveMessage(message)
  }, [])

  async function handleItemClick(id: string) {
    announce('Marking notification as read...')
    await handleMarkAsRead(id)
    onClose()
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
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-[var(--z-dropdown)] w-80 max-h-[28rem] flex flex-col overflow-hidden shadow-xl glass-elevated rounded-theme"
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-glass-border)' }}
      >
        <span
          className="text-body font-semibold text-primary"
        >
          Notifications
        </span>
        {hasNotifications && (
          <button
            onClick={handleClearAllClick}
            className="text-body font-medium transition-opacity hover:opacity-70 text-primary min-h-[44px] min-w-[44px]"
          >
            Clear
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {notifications === undefined && (
          <div className="flex items-center justify-center py-6 text-primary">
            <Spinner />
          </div>
        )}
        {notifications?.length === 0 && (
          <p
            className="text-body text-center py-6 text-secondary"
          >
            No notifications.
          </p>
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

      {/* Screen reader announcements */}
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
