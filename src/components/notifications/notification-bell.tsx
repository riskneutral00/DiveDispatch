'use client'

import { Bell } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { NotificationPanel } from './notification-panel'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { user } = useCurrentUser()
  const userId = user?.slug ?? ''

  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    userId ? { userId } : 'skip',
  )

  if (!user) return null

  return (
    <div className="relative">
      <button
        aria-label={
          unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center w-11 h-11 rounded-full transition-colors text-secondary"
      >
        <Bell size={18} />
        {!!unreadCount && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1" /* design-ok */
            style={{
              background: 'var(--color-status-urgent)',
              color: 'var(--color-text-on-primary)',
            }}
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationPanel
          userId={userId}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
