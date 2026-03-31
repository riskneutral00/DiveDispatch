'use client'

import { useEffect, useRef, useState, useCallback, type RefObject } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { NotificationItem } from './notification-item'
import { useOptimisticNotifications } from '@/lib/hooks/use-optimistic-notifications'

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

interface NotificationPanelProps {
  userId: string
  onClose: () => void
  triggerRef?: RefObject<HTMLElement | null>
}

export function NotificationPanel({ userId, onClose, triggerRef }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [liveMessage, setLiveMessage] = useState('')
  const {
    notifications,
    handleMarkAsRead,
    handleDelete,
    handleClearAll,
  } = useOptimisticNotifications({ userId, limit: 20 })

  // Move focus into the panel on mount
  useEffect(() => {
    if (panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      firstFocusable?.focus()
    }
  }, [])

  // Restore focus to trigger on unmount
  useEffect(() => {
    const trigger = triggerRef?.current
    return () => {
      trigger?.focus()
    }
  }, [triggerRef])

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

  // Close on Escape (scoped — only when panel is focused)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && panelRef.current?.contains(document.activeElement)) {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Focus trap: keep Tab / Shift+Tab within panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !panelRef.current) return

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

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
      className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[28rem] flex flex-col overflow-hidden shadow-xl"
      style={{
        background: 'var(--color-glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--color-glass-border)',
        borderRadius: 'var(--border-radius)',
      }}
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
          className="text-sm font-semibold text-primary"
        >
          Notifications
        </span>
        {hasNotifications && (
          <button
            onClick={handleClearAllClick}
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
