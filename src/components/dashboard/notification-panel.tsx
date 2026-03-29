'use client'

import { useEffect, useRef } from 'react'
import { Spinner } from '@/components/common/spinner'
import { NotificationItem } from './notification-item'
import { useOptimisticNotifications } from '@/lib/hooks/use-optimistic-notifications'

interface NotificationPanelProps {
  userId: string
  onClose: () => void
}

export function NotificationPanel({ userId, onClose }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const {
    notifications,
    handleMarkAsRead,
    handleDelete,
    handleClearAll,
  } = useOptimisticNotifications({ userId, limit: 20 })

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleItemClick(id: string) {
    await handleMarkAsRead(id)
    onClose()
  }

  const hasNotifications = (notifications?.length ?? 0) > 0

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[28rem] flex flex-col overflow-hidden shadow-xl"
      style={{
        background: 'var(--color-glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-glass-border)',
        borderRadius: 'var(--border-radius)',
      }}
      role="dialog"
      aria-label="Notifications"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-glass-border)' }}
      >
        <span
          className="text-sm font-semibold text-primary"
        >
          Notifications
        </span>
        {hasNotifications && (
          <button
            onClick={handleClearAll}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--color-primary)' }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {notifications === undefined && (
          <div className="flex items-center justify-center py-6" style={{ color: 'var(--color-primary)' }}>
            <Spinner />
          </div>
        )}
        {notifications?.length === 0 && (
          <p
            className="text-sm text-center py-6 text-secondary"
          >
            No notifications yet.
          </p>
        )}
        {notifications?.map((n) => (
          <NotificationItem
            key={n._id}
            notification={n}
            onClick={handleItemClick}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  )
}
